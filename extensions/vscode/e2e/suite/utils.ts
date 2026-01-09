import * as assert from 'node:assert';
import * as path from 'node:path';
import * as vscode from 'vscode';

// Singleton document to be used across tests
let openDoc: vscode.TextDocument;

const workspacePath = path.join(__dirname, '../workspace');

/**
 * Opens a document in the test workspace.
 * Sets the shared `openDoc` variable to the opened document.
 * Waits until the TypeScript server provides the hover information.
 */
export async function openDocument(fileName: string): Promise<void> {
	const uri = vscode.Uri.file(path.join(workspacePath, fileName));

	const doc = await vscode.workspace.openTextDocument(uri);

	await vscode.window.showTextDocument(doc);

	openDoc = doc;
}

/**
 * Ensures the TypeScript language server is fully initialized and ready to provide rich type information.
 *
 * @remarks
 * This method of waiting for server readiness by inspecting hover content is a heuristic.
 * More robust or direct methods for determining server readiness should be explored
 * for better test stability and reliability.
 */
export async function ensureTypeScriptServerReady(fileName: string, keyword: string): Promise<void> {
	await openDocument(fileName);

	console.log('Waiting for TypeScript server to be ready...');

	if (!openDoc) {
		throw new Error(`Document ${fileName} was not opened successfully.`);
	}

	const keywordIndex = openDoc.getText().indexOf(keyword);
	if (keywordIndex === -1) {
		throw new Error(`Keyword "${keyword}" not found in ${fileName}`);
	}

	const position = openDoc.positionAt(keywordIndex);

	let attempt = 0;
	const maxAttempts = 60; // Approx 30 seconds if each attempt is 500ms
	const retryDelay = 500; // ms

	while (attempt < maxAttempts) {
		attempt++;
		const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
			'vscode.executeHoverProvider',
			openDoc.uri,
			position,
		);

		// We are interested in the first hover provider, which is TypeScript's native hover.
		const content = hovers[0]?.contents[0];
		if (!content) {
			await new Promise(resolve => setTimeout(resolve, retryDelay));
			continue;
		}

		const hover = typeof content === 'string' ? content : content.value;

		// Check that the server is ready and AST is parsed.
		// The server is considered ready when it provides hover content
		// that is not still "loading" or empty.
		if (!hover.includes('loading') && hover.trim().length > 0) {
			console.log(`TypeScript server is ready after ${attempt} attempts.`);
			return; // Server is ready
		}

		if (attempt % 10 === 0) {
			// Log progress occasionally
			console.log(`Still waiting for TS server... Attempt ${attempt}.`);
		}
		await new Promise(resolve => setTimeout(resolve, retryDelay));
	}
	throw new Error(`TypeScript server did not become ready after ${maxAttempts} attempts.`);
}

/**
 * Retrieves the hover information for a given keyword in the currently opened document.
 * @returns {Promise<string>} The prettified type string from the hover content with whitespace normalized.
 */
export async function getHover(
	getPosition: (doc: vscode.TextDocument) => vscode.Position,
): Promise<string[]> {
	const position = getPosition(openDoc);

	const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
		'vscode.executeHoverProvider',
		openDoc.uri,
		position,
	);

	assert.ok(hovers, 'Expected hover results to be defined');
	assert.ok(hovers.length > 0, 'Expected at least one hover result');

	return hovers
		.map(hover => hover.contents[0])
		.filter(content => content !== undefined)
		.map(content => (typeof content === 'string' ? content : content.value))
		.map(normalizeTypeString); // Normalize each hover content type string
}

/**
 * Cleans up a TypeScript type string by removing specific Markdown fences and normalizing whitespace.
 * This function is used to ensure that the type string is in a clean format for comparison.
 */
function normalizeTypeString(input: string): string {
	let type = input.trim();

	// Remove the specific TypeScript Markdown fences
	const leadingFence = '```typescript\n';
	const trailingFence = '\n```';

	if (type.startsWith(leadingFence)) {
		type = type.substring(leadingFence.length);
	}

	if (type.endsWith(trailingFence)) {
		type = type.substring(0, type.length - trailingFence.length);
	}

	type = type
		.replace(/\s+/g, ' ') // Collapse all whitespace (including newlines/tabs) to single spaces
		.trim(); // Remove leading/trailing spaces

	// Remove a single trailing semicolon, if present
	if (type.endsWith(';')) {
		type = type.slice(0, -1).trim();
	}

	return type;
}

/**
 * Asserts that actual hover contents match the expected content
 * after normalization (e.g. whitespace and Markdown fences removed).
 */
export function assertHover(hovers: string[], expected: string): void {
	const normalizedExpected = normalizeTypeString(expected);
	assert.ok(
		hovers.includes(normalizedExpected),
		`Expected hover content to be "${expected}", but got "${hovers.join(', ')}"`,
	);
}

/**
 * Returns the index of the nth occurrence of a pattern in a string.
 * @returns The index of the nth match, or -1 if not found.
 */
export function nthIndex(str: string, pattern: string, n: number): number {
	let index = -1;
	for (let i = 0; i < n; i++) {
		index = str.indexOf(pattern, index + 1);
		if (index === -1) break;
	}
	return index;
}

/**
 * Retrieves diagnostics for the currently opened document.
 * Waits for diagnostics to be published if they haven't arrived yet.
 * @param fileName - Optional file name to get diagnostics for. If not provided, uses the currently opened document.
 * @param waitMs - Maximum time to wait for diagnostics to arrive (default: 3000ms).
 * @returns Array of vscode.Diagnostic objects with message, range, and severity info.
 */
export async function getDiagnostics(fileName?: string, waitMs: number = 3000): Promise<vscode.Diagnostic[]> {
	const doc = fileName ? await vscode.workspace.openTextDocument(
		vscode.Uri.file(path.join(workspacePath, fileName))
	) : openDoc;

	assert.ok(doc, `Document ${fileName || 'not specified'} was not opened.`);

	// Wait for diagnostics to be published
	const startTime = Date.now();
	const checkInterval = 100; // ms

	while (Date.now() - startTime < waitMs) {
		const allDiagnostics = vscode.languages.getDiagnostics(doc.uri);

		// If we got diagnostics, return them immediately
		if (allDiagnostics.length > 0) {
			return allDiagnostics;
		}

		// Otherwise wait a bit and try again
		await new Promise(resolve => setTimeout(resolve, checkInterval));
	}

	// Return whatever we have after timeout (even if empty)
	return vscode.languages.getDiagnostics(doc.uri);
}

/**
 * Retrieves completions at a specific position in the currently opened document.
 * @param getPosition - Callback function that receives the document and returns the position to get completions at.
 * @returns Array of completion items with label, kind, and other properties.
 */
export async function getCompletions(
	getPosition: (doc: vscode.TextDocument) => vscode.Position,
): Promise<vscode.CompletionItem[]> {
	const position = getPosition(openDoc);

	const completionList = await vscode.commands.executeCommand<vscode.CompletionList>(
		'vscode.executeCompletionItemProvider',
		openDoc.uri,
		position,
	);

	assert.ok(completionList, 'Expected completion list to be defined');

	return completionList.items || [];
}

/**
 * Gets the "Go to Definition" location for a position in the currently opened document.
 * @param getPosition - Callback function that receives the document and returns the position.
 * @returns Array of Location objects (can be multiple if multiple definitions exist).
 */
export async function goToDefinition(
	getPosition: (doc: vscode.TextDocument) => vscode.Position,
): Promise<vscode.Location[]> {
	const position = getPosition(openDoc);

	const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
		'vscode.executeDefinitionProvider',
		openDoc.uri,
		position,
	);

	assert.ok(definitions, 'Expected definition results to be defined');

	return definitions || [];
}

/**
 * Finds all references to a symbol at a position in the currently opened document.
 * @param getPosition - Callback function that receives the document and returns the position.
 * @returns Array of Location objects pointing to all references.
 */
export async function findReferences(
	getPosition: (doc: vscode.TextDocument) => vscode.Position,
): Promise<vscode.Location[]> {
	const position = getPosition(openDoc);

	const references = await vscode.commands.executeCommand<vscode.Location[]>(
		'vscode.executeReferenceProvider',
		openDoc.uri,
		position,
	);

	assert.ok(references, 'Expected reference results to be defined');

	return references || [];
}

/**
 * Waits for diagnostics to be published for the current document.
 * Useful after making changes to allow LSP to catch up.
 * @param maxWaitMs - Maximum time to wait for diagnostics (default: 5000ms).
 * @param expectedDiagnosticCount - Optional expected number of diagnostics to wait for.
 */
export async function waitForDiagnostics(
	maxWaitMs: number = 5000,
	expectedDiagnosticCount?: number,
): Promise<void> {
	const startTime = Date.now();
	const checkInterval = 100;

	while (Date.now() - startTime < maxWaitMs) {
		const diagnostics = await getDiagnostics();

		if (expectedDiagnosticCount !== undefined) {
			if (diagnostics.length === expectedDiagnosticCount) {
				return; // Got the expected count
			}
		} else {
			// Just wait for at least one update cycle
			return;
		}

		await new Promise(resolve => setTimeout(resolve, checkInterval));
	}

	console.warn(
		`Waited ${maxWaitMs}ms for diagnostics but did not reach expected count.`,
	);
}

/**
 * Modifies the content of a file and waits for the LSP to process the change.
 * @param fileName - Name of the file to modify (relative to workspace).
 * @param modifyFn - Function that receives the current content and returns the new content.
 * @param waitAfterMs - Time to wait after modification for LSP to process (default: 500ms).
 */
export async function modifyFile(
	fileName: string,
	modifyFn: (content: string) => string,
	waitAfterMs: number = 500,
): Promise<void> {
	const fileUri = vscode.Uri.file(path.join(workspacePath, fileName));
	const doc = await vscode.workspace.openTextDocument(fileUri);
	const currentContent = doc.getText();
	const newContent = modifyFn(currentContent);

	const edit = new vscode.WorkspaceEdit();
	edit.replace(
		fileUri,
		new vscode.Range(0, 0, doc.lineCount, 0),
		newContent,
	);

	const success = await vscode.workspace.applyEdit(edit);
	assert.ok(success, `Failed to modify file ${fileName}`);

	// Wait for LSP to process the change
	await new Promise(resolve => setTimeout(resolve, waitAfterMs));
}

/**
 * Assertion helper for checking diagnostic content.
 * @param diagnostics - Array of diagnostics from getDiagnostics().
 * @param expectedMessage - Text that should appear in the diagnostic message.
 * @param expectedLineContent - Optional: text that should appear on the diagnostic's line.
 */
export function assertDiagnostic(
	diagnostics: vscode.Diagnostic[],
	expectedMessage: string,
	expectedLineContent?: string,
): vscode.Diagnostic {
	const diagnostic = diagnostics.find(d => {
		const messageMatches = typeof d.message === 'string'
			? d.message.includes(expectedMessage)
			: false;

		if (!messageMatches) return false;

		if (expectedLineContent && openDoc) {
			const line = openDoc.lineAt(d.range.start.line).text;
			return line.includes(expectedLineContent);
		}

		return true;
	});

	assert.ok(diagnostic, `Expected diagnostic with message containing "${expectedMessage}"`);

	return diagnostic!;
}

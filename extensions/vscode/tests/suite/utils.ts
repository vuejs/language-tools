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

	const position = openDoc.positionAt(openDoc.getText().indexOf(keyword));

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

		// Check for specific content indicating the server is ready and AST is parsed
		// "a?: string" is part of the ServerReadinessProbe type definition in canary.ts
		if (!hover.includes('loading') && hover.includes('a?: string')) {
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

import type { VirtualFile } from '@volar/language-core';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceRuntimeContext } from '../types';
import * as shared from '@volar/shared';
import { SourceMap } from '@volar/source-map';
import { stringToSnapshot } from '../utils/common';

export function register(context: LanguageServiceRuntimeContext) {

	return async (
		uri: string,
		options: vscode.FormattingOptions,
		range?: vscode.Range,
		onTypeParams?: {
			ch: string,
			position: vscode.Position,
		},
	) => {

		let document = context.getTextDocument(uri);
		if (!document) return;

		range ??= vscode.Range.create(document.positionAt(0), document.positionAt(document.getText().length));

		const source = context.documents.getSourceByUri(document.uri);
		if (!source) {
			return onTypeParams
				? await tryFormat(document, onTypeParams.position, undefined, onTypeParams.ch)
				: await tryFormat(document, range, undefined);
		}

		const originalSnapshot = source[0];
		const rootVirtualFile = source[1];
		const originalDocument = document;
		const initialIndentLanguageId = await context.env.configurationHost?.getConfiguration<Record<string, boolean>>('volar.format.initialIndent') ?? { html: true };

		let level = 0;
		let edited = false;

		while (true) {

			const embeddedFiles = getEmbeddedFilesByLevel(rootVirtualFile, level++);
			if (embeddedFiles.length === 0)
				break;

			let edits: vscode.TextEdit[] = [];
			let toPatchIndent: {
				sourceMapEmbeddedDocumentUri: string,
			} | undefined;

			for (const embedded of embeddedFiles) {

				if (!embedded.capabilities.documentFormatting)
					continue;

				const maps = [...context.documents.getMapsByVirtualFileName(embedded.fileName)];
				const map = maps.find(map => map[1].sourceFileDocument.uri === document!.uri)?.[1];
				if (!map)
					continue;

				const initialIndentBracket = typeof embedded.capabilities.documentFormatting === 'object' && initialIndentLanguageId[map.virtualFileDocument.languageId]
					? embedded.capabilities.documentFormatting.initialIndentBracket
					: undefined;

				let _edits: vscode.TextEdit[] | undefined;

				if (onTypeParams) {

					const embeddedPosition = map.toGeneratedPosition(onTypeParams.position);

					if (embeddedPosition) {
						_edits = await tryFormat(
							map.virtualFileDocument,
							embeddedPosition,
							initialIndentBracket,
							onTypeParams.ch,
						);
					}
				}

				else {

					let genRange = map.toGeneratedRange(range);

					if (!genRange) {
						const firstMapping = map.map.mappings.sort((a, b) => a.sourceRange[0] - b.sourceRange[0])[0];
						const lastMapping = map.map.mappings.sort((a, b) => b.sourceRange[0] - a.sourceRange[0])[0];
						if (
							firstMapping && document.offsetAt(range.start) < firstMapping.sourceRange[0]
							&& lastMapping && document.offsetAt(range.end) > lastMapping.sourceRange[1]
						) {
							genRange = {
								start: map.virtualFileDocument.positionAt(firstMapping.generatedRange[0]),
								end: map.virtualFileDocument.positionAt(lastMapping.generatedRange[1]),
							};
						}
					}

					if (genRange) {

						toPatchIndent = {
							sourceMapEmbeddedDocumentUri: map.virtualFileDocument.uri,
						};

						_edits = await tryFormat(
							map.virtualFileDocument,
							genRange,
							initialIndentBracket,
						);
					}
				}

				if (!_edits)
					continue;

				for (const textEdit of _edits) {
					const range = map.toSourceRange(textEdit.range);
					if (range) {
						edits.push({
							newText: textEdit.newText,
							range,
						});
					}
				}
			}

			if (edits.length > 0) {
				const newText = TextDocument.applyEdits(document, edits);
				document = TextDocument.create(document.uri, document.languageId, document.version + 1, newText);
				context.core.virtualFiles.update(shared.getPathOfUri(document.uri), stringToSnapshot(document.getText()));
				edited = true;
			}

			if (toPatchIndent) {

				for (const [_, map] of context.documents.getMapsByVirtualFileUri(toPatchIndent?.sourceMapEmbeddedDocumentUri)) {

					const indentEdits = patchInterpolationIndent(document, map.map);

					if (indentEdits.length > 0) {
						const newText = TextDocument.applyEdits(document, indentEdits);
						document = TextDocument.create(document.uri, document.languageId, document.version + 1, newText);
						context.core.virtualFiles.update(shared.getPathOfUri(document.uri), stringToSnapshot(document.getText()));
						edited = true;
					}
				}
			}
		}

		if (edited) {
			// recover
			context.core.virtualFiles.update(shared.getPathOfUri(document.uri), originalSnapshot);
		}

		if (document.getText() === originalDocument.getText())
			return;

		const editRange = vscode.Range.create(
			originalDocument.positionAt(0),
			originalDocument.positionAt(originalDocument.getText().length),
		);
		const textEdit = vscode.TextEdit.replace(editRange, document.getText());

		return [textEdit];

		function getEmbeddedFilesByLevel(rootFile: VirtualFile, level: number) {

			const embeddedFilesByLevel: VirtualFile[][] = [[rootFile]];

			while (true) {

				if (embeddedFilesByLevel.length > level)
					return embeddedFilesByLevel[level];

				let nextLevel: VirtualFile[] = [];

				for (const file of embeddedFilesByLevel[embeddedFilesByLevel.length - 1]) {

					nextLevel = nextLevel.concat(file.embeddedFiles);
				}

				embeddedFilesByLevel.push(nextLevel);
			}
		}

		async function tryFormat(
			document: TextDocument,
			range: vscode.Range | vscode.Position,
			initialIndentBracket: [string, string] | undefined,
			ch?: string,
		) {

			let formatDocument = document;
			let formatRange = range;

			if (initialIndentBracket) {
				formatDocument = TextDocument.create(
					document.uri,
					document.languageId,
					document.version,
					initialIndentBracket[0] + document.getText() + initialIndentBracket[1],
				);
				if (vscode.Position.is(range)) {
					formatRange = formatDocument.positionAt(document.offsetAt(range) + initialIndentBracket[0].length);
				}
				else {
					const startOffset = document.offsetAt(range.start);
					const endOffset = document.offsetAt(range.end);
					if (startOffset === 0 && endOffset === document.getText().length) {
						// full format
						formatRange = {
							start: formatDocument.positionAt(0),
							end: formatDocument.positionAt(formatDocument.getText().length),
						};
					}
					else {
						// range format
						formatRange = {
							start: formatDocument.positionAt(startOffset + initialIndentBracket[0].length),
							end: formatDocument.positionAt(endOffset + initialIndentBracket[0].length),
						};
					}
				}
			}

			for (const plugin of context.plugins) {

				let edits: vscode.TextEdit[] | null | undefined;
				let recover: (() => void) | undefined;

				if (formatDocument !== document && isTsDocument(formatDocument) && context.typescript) {
					const formatFileName = shared.getPathOfUri(formatDocument.uri);
					const formatSnapshot = stringToSnapshot(formatDocument.getText());
					const host = context.typescript.languageServiceHost;
					const original = {
						getProjectVersion: host.getProjectVersion,
						getScriptVersion: host.getScriptVersion,
						getScriptSnapshot: host.getScriptSnapshot,
					};
					host.getProjectVersion = () => original.getProjectVersion?.() + '-' + formatDocument.version;
					host.getScriptVersion = (fileName) => {
						if (fileName === formatFileName) {
							return original.getScriptVersion?.(fileName) + '-' + formatDocument.version.toString();
						}
						return original.getScriptVersion?.(fileName);
					};
					host.getScriptSnapshot = (fileName) => {
						if (fileName === formatFileName) {
							return formatSnapshot;
						}
						return original.getScriptSnapshot?.(fileName);
					};
					recover = () => {
						host.getProjectVersion = original.getProjectVersion;
						host.getScriptVersion = original.getScriptVersion;
						host.getScriptSnapshot = original.getScriptSnapshot;
					};
				}

				try {
					if (ch !== undefined && vscode.Position.is(formatRange)) {
						edits = await plugin.formatOnType?.(formatDocument, formatRange, ch, options);
					}
					else if (ch === undefined && vscode.Range.is(formatRange)) {
						edits = await plugin.format?.(formatDocument, formatRange, options);
					}
				}
				catch (err) {
					console.error(err);
				}

				recover?.();

				if (!edits)
					continue;

				if (!edits.length)
					return edits;

				if (initialIndentBracket) {
					let newText = TextDocument.applyEdits(formatDocument, edits);
					newText = newText.substring(
						newText.indexOf(initialIndentBracket[0]) + initialIndentBracket[0].length,
						newText.lastIndexOf(initialIndentBracket[1]),
					);
					if (newText === document.getText()) {
						edits = [];
					}
					else {
						edits = [{
							newText,
							range: {
								start: document.positionAt(0),
								end: document.positionAt(document.getText().length),
							},
						}];
					}
				}

				return edits;
			}
		}
	};
}

function patchInterpolationIndent(document: TextDocument, map: SourceMap) {

	const indentTextEdits: vscode.TextEdit[] = [];

	for (const mapped of map.mappings) {

		const textRange = {
			start: document.positionAt(mapped.sourceRange[0]),
			end: document.positionAt(mapped.sourceRange[1]),
		};
		const text = document.getText(textRange);

		if (text.indexOf('\n') === -1)
			continue;

		const lines = text.split('\n');
		const removeIndent = getRemoveIndent(lines);
		const baseIndent = getBaseIndent(mapped.sourceRange[0]);

		if (removeIndent === baseIndent)
			continue;

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			if (line.startsWith(removeIndent)) {
				lines[i] = line.replace(removeIndent, baseIndent);
			}
			else {
				lines[i] = baseIndent.replace(removeIndent, '') + line;
			}
		}

		indentTextEdits.push({
			newText: lines.join('\n'),
			range: textRange,
		});
	}

	return indentTextEdits;

	function getRemoveIndent(lines: string[]) {
		const lastLine = lines[lines.length - 1];
		return lastLine.substring(0, lastLine.length - lastLine.trimStart().length);
	}

	function getBaseIndent(pos: number) {
		const startPos = document.positionAt(pos);
		const startLineText = document.getText({ start: startPos, end: { line: startPos.line, character: 0 } });
		return startLineText.substring(0, startLineText.length - startLineText.trimStart().length);
	}
}

export function isTsDocument(document: TextDocument) {
	return document.languageId === 'javascript' ||
		document.languageId === 'typescript' ||
		document.languageId === 'javascriptreact' ||
		document.languageId === 'typescriptreact';
}

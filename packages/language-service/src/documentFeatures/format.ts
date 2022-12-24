import type { VirtualFile } from '@volar/language-core';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceMap } from '../documents';
import type { DocumentServiceRuntimeContext } from '../types';

export function register(context: DocumentServiceRuntimeContext) {

	const ts = context.typescript;

	return async (
		document: TextDocument,
		options: vscode.FormattingOptions,
		range?: vscode.Range,
		onTypeParams?: {
			ch: string,
			position: vscode.Position,
		},
	) => {

		if (!range) {
			range = vscode.Range.create(document.positionAt(0), document.positionAt(document.getText().length));
		}

		const virtualFile = context.documents.getVirtualFileByUri(document.uri);
		const originalDocument = document;
		const rootEdits = onTypeParams
			? await tryFormat(document, onTypeParams.position, undefined, onTypeParams.ch)
			: await tryFormat(document, range, undefined);

		if (!virtualFile)
			return rootEdits;

		if (rootEdits?.length) {
			applyEdits(rootEdits);
		}

		let level = 0;

		const initialIndentLanguageId = await context.pluginContext.env.configurationHost?.getConfiguration<Record<string, boolean>>('volar.format.initialIndent') ?? { html: true };

		while (true) {

			tryUpdateVueDocument();

			const embeddedFiles = getEmbeddedFilesByLevel(virtualFile, level++);
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
				const map = maps.find(map => map[1].sourceDocument.uri === document.uri)?.[1];
				if (!map)
					continue;

				const initialIndentBracket = typeof embedded.capabilities.documentFormatting === 'object' && initialIndentLanguageId[map.mappedDocument.languageId]
					? embedded.capabilities.documentFormatting.initialIndentBracket
					: undefined;

				let _edits: vscode.TextEdit[] | undefined;

				if (onTypeParams) {

					const embeddedPosition = map.toGeneratedPosition(onTypeParams.position);

					if (embeddedPosition) {
						_edits = await tryFormat(
							map.mappedDocument,
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
								start: map.mappedDocument.positionAt(firstMapping.generatedRange[0]),
								end: map.mappedDocument.positionAt(lastMapping.generatedRange[1]),
							};
						}
					}

					if (genRange) {

						toPatchIndent = {
							sourceMapEmbeddedDocumentUri: map.mappedDocument.uri,
						};

						_edits = await tryFormat(
							map.mappedDocument,
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
				applyEdits(edits);
			}

			if (toPatchIndent) {

				tryUpdateVueDocument();

				const maps = [...context.documents.getMapsByVirtualFileName(virtualFile.fileName)];
				const map = maps.find(map => map[1].sourceDocument.uri === toPatchIndent?.sourceMapEmbeddedDocumentUri)?.[1];

				if (map) {

					const indentEdits = patchInterpolationIndent(context.documents.getDocumentByFileName(virtualFile.snapshot, virtualFile.fileName), map);

					if (indentEdits.length > 0) {
						applyEdits(indentEdits);
					}
				}
			}
		}

		if (document.getText() === originalDocument.getText())
			return;

		const editRange = vscode.Range.create(
			originalDocument.positionAt(0),
			originalDocument.positionAt(originalDocument.getText().length),
		);
		const textEdit = vscode.TextEdit.replace(editRange, document.getText());

		return [textEdit];

		function tryUpdateVueDocument() {
			if (virtualFile && virtualFile.snapshot.getText(0, virtualFile.snapshot.getLength()) !== document.getText()) {
				context.updateVirtualFile(virtualFile.fileName, ts.ScriptSnapshot.fromString(document.getText()));
			}
		}

		function getEmbeddedFilesByLevel(rootFile: VirtualFile, level: number) {

			const embeddeds = rootFile.embeddedFiles;
			const embeddedsLevels: VirtualFile[][] = [embeddeds];

			while (true) {

				if (embeddedsLevels.length > level)
					return embeddedsLevels[level];

				let nextEmbeddeds: VirtualFile[] = [];

				for (const embeddeds of embeddedsLevels[embeddedsLevels.length - 1]) {

					nextEmbeddeds = nextEmbeddeds.concat(embeddeds.embeddedFiles);
				}

				embeddedsLevels.push(nextEmbeddeds);
			}
		}

		async function tryFormat(document: TextDocument, range: vscode.Range | vscode.Position, initialIndentBracket: [string, string] | undefined, ch?: string) {

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

			context.prepareLanguageServices(formatDocument);

			for (const plugin of context.plugins) {

				let edits: vscode.TextEdit[] | null | undefined;

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

		function applyEdits(textEdits: vscode.TextEdit[]) {

			const newText = TextDocument.applyEdits(document, textEdits);

			if (newText !== document.getText()) {
				document = TextDocument.create(document.uri, document.languageId, document.version + 1, newText);
			}
		}
	};
}

function patchInterpolationIndent(document: TextDocument, map: SourceMap) {

	const indentTextEdits: vscode.TextEdit[] = [];

	for (const mapped of map.map.mappings) {

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

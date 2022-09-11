import type { FileNode } from '@volar/language-core';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedDocumentSourceMap, SourceFileDocument } from '../documents';
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

		const vueDocument = context.getSourceFileDocument(document);
		const originalDocument = document;
		const rootEdits = onTypeParams
			? await tryFormat(document, onTypeParams.position, undefined, onTypeParams.ch)
			: await tryFormat(document, range, undefined);

		if (!vueDocument)
			return rootEdits;

		if (rootEdits?.length) {
			applyEdits(rootEdits);
		}

		let level = 0;

		const initialIndentLanguageId = await context.pluginContext.env.configurationHost?.getConfiguration<Record<string, boolean>>('volar.format.initialIndent') ?? { html: true };

		while (true) {

			tryUpdateVueDocument();

			const embeddeds = getEmbeddedsByLevel(vueDocument[0], level++);

			if (embeddeds.length === 0)
				break;

			let edits: vscode.TextEdit[] = [];
			let toPatchIndent: {
				sourceMapEmbeddedDocumentUri: string,
			} | undefined;

			for (const embedded of embeddeds) {

				if (!embedded.capabilities.formatting)
					continue;

				const sourceMap = vueDocument[0].getSourceMap(embedded);
				const initialIndentBracket = typeof embedded.capabilities.formatting === 'object' && initialIndentLanguageId[sourceMap.mappedDocument.languageId]
					? embedded.capabilities.formatting.initialIndentBracket
					: undefined;

				let _edits: vscode.TextEdit[] | undefined;

				if (onTypeParams) {

					const embeddedPosition = sourceMap.getMappedRange(onTypeParams.position)?.[0].start;

					if (embeddedPosition) {
						_edits = await tryFormat(
							sourceMap.mappedDocument,
							embeddedPosition,
							initialIndentBracket,
							onTypeParams.ch,
						);
					}
				}

				else {

					let embeddedRange = sourceMap.getMappedRange(range.start, range.end)?.[0];

					if (!embeddedRange) {

						let start = sourceMap.getMappedRange(range.start)?.[0].start;
						let end = sourceMap.getMappedRange(range.end)?.[0].end;

						if (!start) {
							const firstMapping = sourceMap.base.mappings.sort((a, b) => a.sourceRange.start - b.sourceRange.start)[0];
							if (firstMapping && document.offsetAt(range.start) < firstMapping.sourceRange.start) {
								start = sourceMap.mappedDocument.positionAt(firstMapping.mappedRange.start);
							}
						}

						if (!end) {
							const lastMapping = sourceMap.base.mappings.sort((a, b) => b.sourceRange.start - a.sourceRange.start)[0];
							if (lastMapping && document.offsetAt(range.end) > lastMapping.sourceRange.end) {
								end = sourceMap.mappedDocument.positionAt(lastMapping.mappedRange.end);
							}
						}

						if (start && end) {
							embeddedRange = { start, end };
						}
					}

					if (embeddedRange) {

						toPatchIndent = {
							sourceMapEmbeddedDocumentUri: sourceMap.mappedDocument.uri,
						};

						_edits = await tryFormat(
							sourceMap.mappedDocument,
							embeddedRange,
							initialIndentBracket,
						);
					}
				}

				if (!_edits)
					continue;

				for (const textEdit of _edits) {
					for (const [range] of sourceMap.getSourceRanges(
						textEdit.range.start,
						textEdit.range.end,
					)) {
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

				const sourceMap = vueDocument[0].getSourceMaps().find(sourceMap => sourceMap.mappedDocument.uri === toPatchIndent?.sourceMapEmbeddedDocumentUri);

				if (sourceMap) {

					const indentEdits = patchInterpolationIndent(vueDocument[0], sourceMap);

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
			if (vueDocument && vueDocument[0].file.text !== document.getText()) {
				context.updateSourceFile(vueDocument[0].file, ts.ScriptSnapshot.fromString(document.getText()));
			}
		}

		function getEmbeddedsByLevel(vueDocument: SourceFileDocument, level: number) {

			const embeddeds = vueDocument.file.embeddeds;
			const embeddedsLevels: FileNode[][] = [embeddeds];

			while (true) {

				if (embeddedsLevels.length > level)
					return embeddedsLevels[level];

				let nextEmbeddeds: FileNode[] = [];

				for (const embeddeds of embeddedsLevels[embeddedsLevels.length - 1]) {

					nextEmbeddeds = nextEmbeddeds.concat(embeddeds.embeddeds);
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

				let newText = TextDocument.applyEdits(formatDocument, edits);

				if (initialIndentBracket) {
					newText = newText.substring(
						newText.indexOf(initialIndentBracket[0]) + initialIndentBracket[0].length,
						newText.lastIndexOf(initialIndentBracket[1]),
					);
				}

				if (newText === document.getText()) {
					return [];
				}

				return [{
					range: {
						start: document.positionAt(0),
						end: document.positionAt(document.getText().length),
					},
					newText,
				}];
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

function patchInterpolationIndent(vueDocument: SourceFileDocument, sourceMap: EmbeddedDocumentSourceMap) {

	const indentTextEdits: vscode.TextEdit[] = [];
	const document = vueDocument.getDocument();

	for (const mapped of sourceMap.base.mappings) {

		const textRange = {
			start: document.positionAt(mapped.sourceRange.start),
			end: document.positionAt(mapped.sourceRange.end),
		};
		const text = document.getText(textRange);

		if (text.indexOf('\n') === -1)
			continue;

		const lines = text.split('\n');
		const removeIndent = getRemoveIndent(lines);
		const baseIndent = getBaseIndent(mapped.sourceRange.start);

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

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import type { EmbeddedStructure } from '@volar/vue-language-core';
import type { DocumentServiceRuntimeContext } from '../types';
import { EmbeddedDocumentSourceMap, VueDocument } from '../vueDocuments';
import { useConfigurationHost } from '@volar/vue-language-service-types';

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

		const originalDocument = document;
		const rootEdits = onTypeParams
			? await tryFormat(document, onTypeParams.position, undefined, onTypeParams.ch)
			: await tryFormat(document, range, undefined);
		const vueDocument = context.getVueDocument(document);

		if (!vueDocument)
			return rootEdits;

		if (rootEdits?.length) {
			applyEdits(rootEdits);
		}

		let level = 0;

		const initialIndentLanguageId = await useConfigurationHost()?.getConfiguration<Record<string, boolean>>('volar.initialIndent') ?? { html: true };

		while (true) {

			tryUpdateVueDocument();

			const embeddeds = getEmbeddedsByLevel(vueDocument, level++);

			if (embeddeds.length === 0)
				break;

			let edits: vscode.TextEdit[] = [];
			let toPatchIndent: {
				sourceMapEmbeddedDocumentUri: string,
			} | undefined;

			for (const embedded of embeddeds) {

				if (!embedded.self?.file.capabilities.formatting)
					continue;

				const sourceMap = vueDocument.sourceMapsMap.get(embedded.self);
				const initialIndentBracket = typeof embedded.self.file.capabilities.formatting === 'object' && initialIndentLanguageId[sourceMap.mappedDocument.languageId]
					? embedded.self.file.capabilities.formatting.initialIndentBracket
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

				const sourceMap = vueDocument.getSourceMaps().find(sourceMap => sourceMap.mappedDocument.uri === toPatchIndent?.sourceMapEmbeddedDocumentUri);

				if (sourceMap) {

					const indentEdits = patchInterpolationIndent(vueDocument, sourceMap);

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
			if (vueDocument) {
				vueDocument.file.update(ts.ScriptSnapshot.fromString(document.getText()));
			}
		}

		function getEmbeddedsByLevel(vueDocument: VueDocument, level: number) {

			const embeddeds = vueDocument.file.embeddeds;
			const embeddedsLevels: EmbeddedStructure[][] = [embeddeds];

			while (true) {

				if (embeddedsLevels.length > level)
					return embeddedsLevels[level];

				let nextEmbeddeds: EmbeddedStructure[] = [];

				for (const embeddeds of embeddedsLevels[embeddedsLevels.length - 1]) {

					nextEmbeddeds = nextEmbeddeds.concat(embeddeds.embeddeds);
				}

				embeddedsLevels.push(nextEmbeddeds);
			}
		}

		async function tryFormat(document: TextDocument, range: vscode.Range | vscode.Position, initialIndentBracket: [string, string] | undefined, ch?: string) {

			const plugins = context.getPlugins();

			let formatDocument = document;
			let formatRange = range;

			if (initialIndentBracket) {
				formatDocument = TextDocument.create(
					document.uri,
					document.languageId,
					document.version,
					initialIndentBracket[0] + document.getText() + initialIndentBracket[1],
				);
				formatRange = {
					start: formatDocument.positionAt(0),
					end: formatDocument.positionAt(formatDocument.getText().length),
				};
			}

			context.updateTsLs(formatDocument);

			for (const plugin of plugins) {

				let edits: vscode.TextEdit[] | null | undefined;

				try {
					if (vscode.Position.is(formatRange)) {
						if (ch !== undefined) {
							edits = await plugin.formatOnType?.(formatDocument, formatRange, ch, options);
						}
					}
					else {
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

function patchInterpolationIndent(vueDocument: VueDocument, sourceMap: EmbeddedDocumentSourceMap) {

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

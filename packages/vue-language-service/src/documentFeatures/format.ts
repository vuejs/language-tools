import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import type { EmbeddedStructure } from '@volar/vue-typescript';
import type { DocumentServiceRuntimeContext } from '../types';
import { EmbeddedDocumentSourceMap, VueDocument } from '../vueDocuments';

export function register(context: DocumentServiceRuntimeContext) {

	return async (document: TextDocument, options: vscode.FormattingOptions, range?: vscode.Range) => {

		if (!range) {
			range = vscode.Range.create(document.positionAt(0), document.positionAt(document.getText().length));
		}

		const originalDocument = document;
		const rootEdits = await tryFormat(document, range);
		const vueDocument = context.getVueDocument(document);

		if (!vueDocument)
			return rootEdits;

		if (rootEdits?.length) {
			applyEdits(rootEdits);
		}

		let level = 0;

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

				let embeddedRange = sourceMap.getMappedRange(range.start, range.end)?.[0];

				if (!embeddedRange) {

					let start = sourceMap.getMappedRange(range.start)?.[0].start;
					let end = sourceMap.getMappedRange(range.end)?.[0].end;

					if (!start) {
						const minSourceStart = Math.min(...sourceMap.mappings.map(m => m.sourceRange.start));
						if (document.offsetAt(range.start) <= minSourceStart) {
							start = range.start;
						}
					}

					if (!end) {
						const maxSourceEnd = Math.max(...sourceMap.mappings.map(m => m.sourceRange.end));
						if (document.offsetAt(range.end) >= maxSourceEnd) {
							end = range.end;
						}
					}

					if (start && end) {
						embeddedRange = { start, end };
					}
				}

				if (!embeddedRange)
					continue;

				if (embedded.inheritParentIndent)
					toPatchIndent = {
						sourceMapEmbeddedDocumentUri: sourceMap.mappedDocument.uri,
					};

				const _edits = await tryFormat(sourceMap.mappedDocument, embeddedRange);

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
			if (vueDocument?.getDocument().getText() !== document.getText()) {
				vueDocument?.file.update(document.getText(), document.version.toString());
			}
		}

		function getEmbeddedsByLevel(vueDocument: VueDocument, level: number) {

			const embeddeds = vueDocument.file.getEmbeddeds();
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

		async function tryFormat(document: TextDocument, range: vscode.Range) {

			const plugins = context.getFormatPlugins();

			context.updateTsLs(document);

			for (const plugin of plugins) {

				if (!plugin.format)
					continue;

				let edits: vscode.TextEdit[] | null | undefined;

				try {
					edits = await plugin.format(document, range, options);
				}
				catch (err) {
					console.error(err);
				}

				if (!edits)
					continue;

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

function patchInterpolationIndent(vueDocument: VueDocument, sourceMap: EmbeddedDocumentSourceMap) {

	const indentTextEdits: vscode.TextEdit[] = [];
	const document = vueDocument.getDocument();

	for (const mapped of sourceMap.mappings) {

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

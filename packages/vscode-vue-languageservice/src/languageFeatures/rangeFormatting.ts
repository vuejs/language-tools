import {
	TextDocument,
	FormattingOptions,
	TextEdit,
	Range,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import * as prettier from 'prettier';
import * as prettyhtml from '@starptech/prettyhtml';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument, range: Range, options: FormattingOptions) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		return formattingWorker(sourceFile, document, options, range, tsLanguageService);
	};
}

export function formattingWorker(sourceFile: SourceFile, document: TextDocument, options: FormattingOptions, range: Range, tsLanguageService: ts2.LanguageService): TextEdit[] | undefined {
	let newDocument = document;

	const htmlEdits = getHtmlFormattingEdits();
	const cssEdits = getCssFormattingEdits();
	newDocument = applyTextEdits(document, filterEditsByRange([...htmlEdits, ...cssEdits]));
	sourceFile.update(newDocument);

	const tsEdits = getTsFormattingEdits();
	newDocument = applyTextEdits(newDocument, filterEditsByRange(tsEdits));
	sourceFile.update(document);

	if (newDocument.getText() === document.getText()) return;

	const editRange = Range.create(
		document.positionAt(0),
		document.positionAt(document.getText().length),
	);
	const textEdit = TextEdit.replace(editRange, newDocument.getText());
	return [textEdit];

	function filterEditsByRange(textEdits: TextEdit[]) {
		return textEdits.filter(edit => edit.range.start.line >= range.start.line && edit.range.end.line <= range.end.line);
	}
	function getCssFormattingEdits() {
		const textEdits: TextEdit[] = [];
		for (const sourceMap of sourceFile.getCssSourceMaps()) {
			for (const maped of sourceMap) {
				const newStyleText = prettier.format(sourceMap.virtualDocument.getText(), {
					tabWidth: options.tabSize,
					useTabs: !options.insertSpaces,
					parser: sourceMap.virtualDocument.languageId === 'scss' ? 'scss' : 'css',
				});

				const vueRange = {
					start: sourceMap.vueDocument.positionAt(maped.vueRange.start),
					end: sourceMap.vueDocument.positionAt(maped.vueRange.end),
				};
				const textEdit = TextEdit.replace(
					vueRange,
					'\n' + newStyleText
				);
				textEdits.push(textEdit);
			}
		}
		return textEdits;
	}
	function getHtmlFormattingEdits() {
		const result: TextEdit[] = [];
		for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
			for (const maped of sourceMap) {

				const prefixes = '<template>';
				const suffixes = '</template>';

				let newHtml = prettyhtml(prefixes + sourceMap.virtualDocument.getText() + suffixes, {
					tabWidth: options.tabSize,
					useTabs: !options.insertSpaces,
					printWidth: 100,
				}).contents;
				newHtml = newHtml.trim();
				newHtml = newHtml.substring(prefixes.length, newHtml.length - suffixes.length);

				const vueRange = {
					start: sourceMap.vueDocument.positionAt(maped.vueRange.start),
					end: sourceMap.vueDocument.positionAt(maped.vueRange.end),
				};
				const textEdit = TextEdit.replace(vueRange, newHtml);
				result.push(textEdit);
			}
		}
		return result;
	}
	function getTsFormattingEdits() {
		const result: TextEdit[] = [];
		for (const sourceMap of sourceFile.getTsSourceMaps()) {
			const textEdits = tsLanguageService.doFormatting(sourceMap.virtualDocument, options);
			for (const textEdit of textEdits) {
				for (const vueLoc of sourceMap.findVueLocations(textEdit.range)) {
					if (!vueLoc.maped.data.capabilities.formatting) continue;
					if (vueLoc.range.start.line < range.start.line) continue;
					if (vueLoc.range.end.line > range.end.line) continue;
					if (vueLoc.range.start.line === range.start.line && vueLoc.range.start.character < range.start.character) continue;
					if (vueLoc.range.end.line === range.end.line && vueLoc.range.end.character > range.end.character) continue;
					{ // patch 'computed' keyword from <script refs>
						const start = sourceMap.vueDocument.positionAt(sourceMap.vueDocument.offsetAt(vueLoc.range.start) + 1);
						const end = sourceMap.vueDocument.positionAt(sourceMap.vueDocument.offsetAt(vueLoc.range.end) + 'puted'.length);
						const range = { start, end };
						const vueText = sourceMap.vueDocument.getText(range);
						if (vueText.endsWith('computed')) {
							vueLoc.range.end = sourceMap.vueDocument.positionAt(sourceMap.vueDocument.offsetAt(vueLoc.range.end) - 'com'.length);
						}
					}
					result.push({
						newText: textEdit.newText,
						range: vueLoc.range,
					});
				}
			}
		}
		return result;
	}
	function applyTextEdits(document: TextDocument, textEdits: TextEdit[]) {

		textEdits = textEdits.sort((a, b) => document.offsetAt(b.range.start) - document.offsetAt(a.range.start));

		let newDocumentText = document.getText();
		for (const textEdit of textEdits) {
			newDocumentText = editText(
				newDocumentText,
				document.offsetAt(textEdit.range.start),
				document.offsetAt(textEdit.range.end),
				textEdit.newText
			)
		}

		return TextDocument.create(document.uri.toString(), document.languageId, document.version + 1, newDocumentText);

		function editText(sourceText: string, startOffset: number, endOffset: number, newText: string) {
			return sourceText.substring(0, startOffset)
				+ newText
				+ sourceText.substring(endOffset, sourceText.length)
		}
	}
}
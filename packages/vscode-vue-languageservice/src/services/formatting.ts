import {
	FormattingOptions,
	TextEdit,
	Range,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { createSourceFile } from '../sourceFiles';
import { getCheapTsService2 } from '../globalServices';
import { rfc } from '../virtuals/script';
import * as prettier from 'prettier';
import * as prettyhtml from '@starptech/prettyhtml';
const pugBeautify = require('pug-beautify');

export function register() {
	return (_document: TextDocument, options: FormattingOptions) => {
		const tsService2 = getCheapTsService2(_document);
		let document = TextDocument.create(tsService2.uri, _document.languageId, _document.version, _document.getText());

		const sourceFile = createSourceFile(document, tsService2.service);
		let newDocument = document;

		const pugEdits = getPugFormattingEdits();
		const htmlEdits = getHtmlFormattingEdits();
		newDocument = applyTextEdits(document, [
			...pugEdits,
			...htmlEdits,
		]);
		sourceFile.update(newDocument);

		const tsEdits = getTsFormattingEdits();
		const cssEdits = getCssFormattingEdits();
		newDocument = applyTextEdits(newDocument, [
			...tsEdits,
			...cssEdits,
		]);
		sourceFile.update(newDocument);

		const indentTextEdits = patchInterpolationIndent();
		newDocument = applyTextEdits(newDocument, indentTextEdits);
		sourceFile.update(document);

		if (newDocument.getText() === document.getText()) return;

		const editRange = Range.create(
			document.positionAt(0),
			document.positionAt(document.getText().length),
		);
		const textEdit = TextEdit.replace(editRange, newDocument.getText());
		return [textEdit];

		function patchInterpolationIndent() {
			const indentTextEdits: TextEdit[] = [];
			for (const tsSourceMap of sourceFile.getTsSourceMaps()) {
				if (!tsSourceMap.isInterpolation)
					continue;

				for (const maped of tsSourceMap) {
					if (!maped.data.capabilities.formatting)
						continue;

					const textRange = {
						start: newDocument.positionAt(maped.sourceRange.start),
						end: newDocument.positionAt(maped.sourceRange.end),
					};
					const text = newDocument.getText(textRange);
					if (text.indexOf('\n') === -1)
						continue;
					const lines = text.split('\n');
					const removeIndent = getRemoveIndent();
					const baseIndent = getBaseIndent();
					for (let i = 1; i < lines.length; i++) {
						const line = lines[i];
						if (line.startsWith(removeIndent)) {
							lines[i] = line.replace(removeIndent, baseIndent);
						}
					}
					indentTextEdits.push({
						newText: lines.join('\n'),
						range: textRange,
					});

					function getRemoveIndent() {
						const lastLine = lines[lines.length - 1];
						return lastLine.substr(0, lastLine.length - lastLine.trimStart().length);
					}
					function getBaseIndent() {
						const startPos = newDocument.positionAt(maped.sourceRange.start);
						const startLineText = newDocument.getText({ start: startPos, end: { line: startPos.line, character: 0 } });
						return startLineText.substr(0, startLineText.length - startLineText.trimStart().length);
					}
				}
			}
			return indentTextEdits;
		}
		function getCssFormattingEdits() {
			const textEdits: TextEdit[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				if (!sourceMap.capabilities.formatting) continue;
				for (const maped of sourceMap) {
					const newStyleText = prettier.format(sourceMap.targetDocument.getText(), {
						tabWidth: options.tabSize,
						useTabs: !options.insertSpaces,
						parser: sourceMap.targetDocument.languageId as any,
					});

					const vueRange = {
						start: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
						end: sourceMap.sourceDocument.positionAt(maped.sourceRange.end),
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

					let newHtml = prettyhtml(prefixes + sourceMap.targetDocument.getText() + suffixes, {
						tabWidth: options.tabSize,
						useTabs: !options.insertSpaces,
						printWidth: 100,
					}).contents;
					newHtml = newHtml.trim();
					newHtml = newHtml.substring(prefixes.length, newHtml.length - suffixes.length);

					const vueRange = {
						start: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
						end: sourceMap.sourceDocument.positionAt(maped.sourceRange.end),
					};
					const textEdit = TextEdit.replace(vueRange, newHtml);
					result.push(textEdit);
				}
			}
			return result;
		}
		function getPugFormattingEdits() {
			const result: TextEdit[] = [];
			for (const sourceMap of sourceFile.getPugSourceMaps()) {
				for (const maped of sourceMap) {
					let newPug = pugBeautify(sourceMap.targetDocument.getText(), {
						tab_size: options.tabSize,
						fill_tab: !options.insertSpaces,
					});
					newPug = '\n' + newPug.trim() + '\n';
					const vueRange = {
						start: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
						end: sourceMap.sourceDocument.positionAt(maped.sourceRange.end),
					};
					const textEdit = TextEdit.replace(vueRange, newPug);
					result.push(textEdit);
				}
			}
			return result;
		}
		function getTsFormattingEdits() {
			const result: TextEdit[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				if (!sourceMap.capabilities.formatting) continue;
				const cheapTs = getCheapTsService2(sourceMap.targetDocument);
				const textEdits = cheapTs.service.doFormatting(cheapTs.uri, options);
				for (const textEdit of textEdits) {
					for (const vueLoc of sourceMap.targetToSources(textEdit.range)) {
						if (!vueLoc.maped.data.capabilities.formatting) continue;
						result.push({
							newText: textEdit.newText,
							range: vueLoc.range,
						});
					}
				}
			}
			if (rfc === '#222') {
				const scriptSetupRaw = sourceFile.getScriptSetupRaw();
				if (scriptSetupRaw.sourceMap?.capabilities.formatting) {
					const sourceMap = scriptSetupRaw.sourceMap;
					const cheapTs = getCheapTsService2(sourceMap.targetDocument);
					const textEdits = cheapTs.service.doFormatting(cheapTs.uri, options);
					/* copy from upside */
					for (const textEdit of textEdits) {
						for (const vueLoc of sourceMap.targetToSources(textEdit.range)) {
							if (!vueLoc.maped.data.capabilities.formatting) continue;
							result.push({
								newText: textEdit.newText,
								range: vueLoc.range,
							});
						}
					}
					/* copy from upside */
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
	};
}

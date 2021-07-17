import * as prettyhtml from '@starptech/prettyhtml';
import * as shared from '@volar/shared';
import { transformTextEdit } from '@volar/transforms';
import * as prettier from 'prettier';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver';
import type { LanguageServiceHost } from 'vscode-typescript-languageservice';
import { createSourceFile } from '../sourceFile';
import type { HtmlLanguageServiceContext } from '../types';
import * as sharedServices from '../utils/sharedLs';

export function register(
	context: HtmlLanguageServiceContext,
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
) {
	const { ts } = context;
	return async (document: TextDocument, options: vscode.FormattingOptions) => {

		const dummyTs = sharedServices.getDummyTsLs(ts, document, getPreferences, getFormatOptions);
		const sourceFile = createSourceFile(document, dummyTs.ls, dummyTs.ls, context);
		let newDocument = document;

		const pugEdits = getPugFormattingEdits();
		const htmlEdits = getHtmlFormattingEdits();
		if (pugEdits.length + htmlEdits.length > 0) {
			newDocument = TextDocument.create(newDocument.uri, newDocument.languageId, newDocument.version + 1, TextDocument.applyEdits(newDocument, [
				...pugEdits,
				...htmlEdits,
			]));
			sourceFile.update(newDocument); // TODO: high cost
		}

		const tsEdits = await getTsFormattingEdits();
		const cssEdits = getCssFormattingEdits();
		if (tsEdits.length + cssEdits.length > 0) {
			newDocument = TextDocument.create(newDocument.uri, newDocument.languageId, newDocument.version + 1, TextDocument.applyEdits(newDocument, [
				...tsEdits,
				...cssEdits,
			]));
			sourceFile.update(newDocument); // TODO: high cost
		}

		const indentTextEdits = patchInterpolationIndent();
		newDocument = TextDocument.create(newDocument.uri, newDocument.languageId, newDocument.version + 1, TextDocument.applyEdits(newDocument, indentTextEdits));
		if (newDocument.getText() === document.getText()) return;

		const editRange = vscode.Range.create(
			document.positionAt(0),
			document.positionAt(document.getText().length),
		);
		const textEdit = vscode.TextEdit.replace(editRange, newDocument.getText());
		return [textEdit];

		function patchInterpolationIndent() {
			const indentTextEdits: vscode.TextEdit[] = [];
			const tsSourceMap = sourceFile.getTemplateFormattingScript().sourceMap;
			if (!tsSourceMap) return indentTextEdits;

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
					else {
						lines[i] = baseIndent.replace(removeIndent, '') + line;
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
			return indentTextEdits;
		}
		function getCssFormattingEdits() {
			const textEdits: vscode.TextEdit[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				if (!sourceMap.capabilities.formatting) continue;
				for (const maped of sourceMap) {

					const languageId = sourceMap.mappedDocument.languageId;
					if (
						languageId !== 'css'
						&& languageId !== 'less'
						&& languageId !== 'scss'
						&& languageId !== 'postcss'
					) continue;

					const newStyleText = prettier.format(sourceMap.mappedDocument.getText(), {
						tabWidth: options.tabSize,
						useTabs: !options.insertSpaces,
						parser: languageId,
					});

					const vueRange = {
						start: sourceMap.sourceDocument.positionAt(maped.sourceRange.start),
						end: sourceMap.sourceDocument.positionAt(maped.sourceRange.end),
					};
					const textEdit = vscode.TextEdit.replace(
						vueRange,
						'\n' + newStyleText
					);
					textEdits.push(textEdit);
				}
			}
			return textEdits;
		}
		function getHtmlFormattingEdits() {
			const result: vscode.TextEdit[] = [];
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				for (const maped of sourceMap) {

					const prefixes = '<template>';
					const suffixes = '</template>';

					let newHtml = prettyhtml(prefixes + sourceMap.mappedDocument.getText() + suffixes, {
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
					const textEdit = vscode.TextEdit.replace(vueRange, newHtml);
					result.push(textEdit);
				}
			}
			return result;
		}
		function getPugFormattingEdits() {
			let result: vscode.TextEdit[] = [];
			for (const sourceMap of sourceFile.getPugSourceMaps()) {
				const pugEdits = context.pugLs.format(sourceMap.pugDocument, options);
				const vueEdits = pugEdits
					.map(pugEdit => transformTextEdit(
						pugEdit,
						pugRange => sourceMap.getSourceRange(pugRange.start, pugRange.end),
					))
					.filter(shared.notEmpty);
				result = result.concat(vueEdits);
			}
			return result;
		}
		async function getTsFormattingEdits() {
			const result: vscode.TextEdit[] = [];
			const tsSourceMaps = [
				sourceFile.getTemplateFormattingScript().sourceMap,
				...sourceFile.docLsScripts().sourceMaps,
			].filter(shared.notEmpty);

			for (const sourceMap of tsSourceMaps) {
				if (!sourceMap.capabilities.formatting) continue;
				const dummyTs = sharedServices.getDummyTsLs(ts, sourceMap.mappedDocument, getPreferences, getFormatOptions);
				const textEdits = await dummyTs.ls.doFormatting(dummyTs.uri, options);
				for (const textEdit of textEdits) {
					for (const vueRange of sourceMap.getSourceRanges(textEdit.range.start, textEdit.range.end)) {
						if (!vueRange.data.capabilities.formatting) continue;
						result.push({
							newText: textEdit.newText,
							range: vueRange,
						});
					}
				}
			}
			return result;
		}
	};
}

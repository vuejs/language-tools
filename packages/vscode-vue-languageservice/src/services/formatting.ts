import * as shared from '@volar/shared';
import { transformTextEdit } from '@volar/transforms';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceHost } from 'vscode-typescript-languageservice';
import type { SourceFile } from '@volar/vue-typescript';
import type { DocumentServiceRuntimeContext } from '../types';
import * as sharedServices from '../utils/sharedLs';
import * as ts2 from 'vscode-typescript-languageservice';

type Promiseable<T> = T | Promise<T>;

export function register(
	context: DocumentServiceRuntimeContext,
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
	formatters: { [lang: string]: (document: TextDocument, options: vscode.FormattingOptions) => Promiseable<vscode.TextEdit[]> },
) {
	return async (document: TextDocument, options: vscode.FormattingOptions) => {

		const sourceFile = context.getVueDocument(document);
		if (!sourceFile) {
			// take over mode
			const dummyTsLs = sharedServices.getDummyTsLs(context.typescript, ts2, document, getPreferences, getFormatOptions);
			return await dummyTsLs.doFormatting(document.uri, options);
		}
		let newDocument = document;

		const pugEdits = await getPugFormattingEdits(sourceFile, options);
		const htmlEdits = await getHtmlFormattingEdits(sourceFile, options);
		if (pugEdits.length + htmlEdits.length > 0) {
			newDocument = TextDocument.create(newDocument.uri, newDocument.languageId, newDocument.version + 1, TextDocument.applyEdits(newDocument, [
				...pugEdits,
				...htmlEdits,
			]));
			sourceFile.update(newDocument.getText(), newDocument.version.toString()); // TODO: high cost
		}

		const tsEdits = await getTsFormattingEdits(sourceFile, options);
		const cssEdits = await getCssFormattingEdits(sourceFile, options);
		if (tsEdits.length + cssEdits.length > 0) {
			newDocument = TextDocument.create(newDocument.uri, newDocument.languageId, newDocument.version + 1, TextDocument.applyEdits(newDocument, [
				...tsEdits,
				...cssEdits,
			]));
			sourceFile.update(newDocument.getText(), newDocument.version.toString()); // TODO: high cost
		}

		const indentTextEdits = patchInterpolationIndent(sourceFile);
		newDocument = TextDocument.create(newDocument.uri, newDocument.languageId, newDocument.version + 1, TextDocument.applyEdits(newDocument, indentTextEdits));
		if (newDocument.getText() === document.getText()) return;

		const editRange = vscode.Range.create(
			document.positionAt(0),
			document.positionAt(document.getText().length),
		);
		const textEdit = vscode.TextEdit.replace(editRange, newDocument.getText());
		return [textEdit];
	};

	function patchInterpolationIndent(sourceFile: SourceFile) {
		const indentTextEdits: vscode.TextEdit[] = [];
		const tsSourceMap = sourceFile.getTemplateFormattingScript().sourceMap;
		if (!tsSourceMap) return indentTextEdits;

		const document = sourceFile.getTextDocument();
		for (const maped of tsSourceMap.mappings) {
			if (!maped.data.capabilities.formatting)
				continue;

			const textRange = {
				start: document.positionAt(maped.sourceRange.start),
				end: document.positionAt(maped.sourceRange.end),
			};
			const text = document.getText(textRange);
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
				const startPos = document.positionAt(maped.sourceRange.start);
				const startLineText = document.getText({ start: startPos, end: { line: startPos.line, character: 0 } });
				return startLineText.substr(0, startLineText.length - startLineText.trimStart().length);
			}
		}
		return indentTextEdits;
	}

	async function getCssFormattingEdits(sourceFile: SourceFile, options: vscode.FormattingOptions) {
		const result: vscode.TextEdit[] = [];
		for (const sourceMap of sourceFile.getCssSourceMaps()) {

			if (!sourceMap.capabilities.formatting) continue;

			const formatter = formatters[sourceMap.mappedDocument.languageId];
			if (!formatter) continue;

			const cssEdits = await formatter(sourceMap.mappedDocument, options);
			for (const cssEdit of cssEdits) {
				const vueEdit = transformTextEdit(cssEdit, cssRange => sourceMap.getSourceRange(cssRange.start, cssRange.end)?.[0]);
				if (vueEdit) {
					result.push(vueEdit);
				}
			}
		}
		return result;
	}

	async function getHtmlFormattingEdits(sourceFile: SourceFile, options: vscode.FormattingOptions) {
		const result: vscode.TextEdit[] = [];
		for (const sourceMap of sourceFile.getTemplateSourceMaps()) {

			if (sourceMap.mappedDocument.languageId !== 'html')
				continue;

			const formatter = formatters['html'];
			if (!formatter) continue;

			const htmlEdits = await formatter(sourceMap.mappedDocument, options);
			for (const htmlEdit of htmlEdits) {
				const vueEdit = transformTextEdit(htmlEdit, htmlRange => sourceMap.getSourceRange(htmlRange.start, htmlRange.end)?.[0]);
				if (vueEdit) {
					result.push(vueEdit);
				}
			}
		}
		return result;
	}

	async function getPugFormattingEdits(sourceFile: SourceFile, options: vscode.FormattingOptions) {
		const result: vscode.TextEdit[] = [];
		for (const sourceMap of sourceFile.getTemplateSourceMaps()) {

			if (sourceMap.mappedDocument.languageId !== 'jade')
				continue;

			const formatter = formatters['pug'];
			if (!formatter) continue;

			const pugEdits = await formatter(sourceMap.mappedDocument, options);
			for (const pugEdit of pugEdits) {
				const vueEdit = transformTextEdit(pugEdit, pugRange => sourceMap.getSourceRange(pugRange.start, pugRange.end)?.[0]);
				if (vueEdit) {
					result.push(vueEdit);
				}
			}
		}
		return result;
	}

	async function getTsFormattingEdits(sourceFile: SourceFile, options: vscode.FormattingOptions) {
		const result: vscode.TextEdit[] = [];
		const tsSourceMaps = [
			sourceFile.getTemplateFormattingScript().sourceMap,
			...sourceFile.docLsScripts().sourceMaps,
		].filter(shared.notEmpty);

		for (const sourceMap of tsSourceMaps) {
			if (!sourceMap.capabilities.formatting) continue;
			const dummyTsLs = sharedServices.getDummyTsLs(context.typescript, ts2, sourceMap.mappedDocument, getPreferences, getFormatOptions);
			const textEdits = await dummyTsLs.doFormatting(sourceMap.mappedDocument.uri, options);
			for (const textEdit of textEdits) {
				for (const [vueRange] of sourceMap.getSourceRanges(
					textEdit.range.start,
					textEdit.range.end,
					data => !!data.capabilities.formatting,
				)) {
					result.push({
						newText: textEdit.newText,
						range: vueRange,
					});
				}
			}
		}
		return result;
	}
}

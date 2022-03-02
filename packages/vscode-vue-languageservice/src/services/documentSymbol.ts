import * as shared from '@volar/shared';
import { transformSymbolInformations } from '@volar/transforms';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type { LanguageServiceHost } from 'vscode-typescript-languageservice';
import type { SourceFile } from '../sourceFile';
import type { HtmlLanguageServiceContext } from '../types';
import { getDummyTsLs } from '../utils/sharedLs';
import * as dedupe from '../utils/dedupe';

export function register(
	context: HtmlLanguageServiceContext,
	getPreferences: LanguageServiceHost['getPreferences'],
	getFormatOptions: LanguageServiceHost['getFormatOptions'],
) {

	const { modules, htmlLs, pugLs, getCssLs, getStylesheet, getHtmlDocument, getPugDocument } = context;

	return (document: TextDocument) => {

		const sourceFile = context.getVueDocument(document);
		if (!sourceFile) {
			// take over mode
			const dummyTsLs = getDummyTsLs(modules.typescript, modules.ts, document, getPreferences, getFormatOptions);
			return dummyTsLs.findDocumentSymbols(document.uri);
		}

		const vueResult = getVueResult(sourceFile);
		const tsResult = getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = getCssResult(sourceFile);

		return [
			...vueResult,
			...tsResult,
			...htmlResult,
			...cssResult,
		];

		function getVueResult(sourceFile: SourceFile) {

			const result: vscode.SymbolInformation[] = [];
			const desc = sourceFile.getDescriptor();

			if (desc.template) {
				result.push({
					name: '<template>',
					kind: vscode.SymbolKind.Module,
					location: vscode.Location.create(document.uri, vscode.Range.create(
						document.positionAt(desc.template.startTagEnd),
						document.positionAt(desc.template.startTagEnd + desc.template.content.length),
					)),
				});
			}
			if (desc.script) {
				result.push({
					name: '<script>',
					kind: vscode.SymbolKind.Module,
					location: vscode.Location.create(document.uri, vscode.Range.create(
						document.positionAt(desc.script.startTagEnd),
						document.positionAt(desc.script.startTagEnd + desc.script.content.length),
					)),
				});
			}
			if (desc.scriptSetup) {
				result.push({
					name: '<script setup>',
					kind: vscode.SymbolKind.Module,
					location: vscode.Location.create(document.uri, vscode.Range.create(
						document.positionAt(desc.scriptSetup.startTagEnd),
						document.positionAt(desc.scriptSetup.startTagEnd + desc.scriptSetup.content.length),
					)),
				});
			}
			for (const style of desc.styles) {
				result.push({
					name: `<${['style', style.scoped ? 'scoped' : undefined, style.module ? 'module' : undefined].filter(shared.notEmpty).join(' ')}>`,
					kind: vscode.SymbolKind.Module,
					location: vscode.Location.create(document.uri, vscode.Range.create(
						document.positionAt(style.startTagEnd),
						document.positionAt(style.startTagEnd + style.content.length),
					)),
				});
			}
			for (const customBlock of desc.customBlocks) {
				result.push({
					name: `<${customBlock.type}>`,
					kind: vscode.SymbolKind.Module,
					location: vscode.Location.create(document.uri, vscode.Range.create(
						document.positionAt(customBlock.startTagEnd),
						document.positionAt(customBlock.startTagEnd + customBlock.content.length),
					)),
				});
			}

			return result;
		}
		function getTsResult(sourceFile: SourceFile) {

			let result: vscode.SymbolInformation[] = [];
			const tsSourceMaps = [
				sourceFile.getTemplateFormattingScript().sourceMap,
				...sourceFile.docLsScripts().sourceMaps,
			].filter(shared.notEmpty);

			for (const sourceMap of tsSourceMaps) {
				if (!sourceMap.capabilities.documentSymbol) continue;
				const dummyTsLs = getDummyTsLs(modules.typescript, modules.ts, sourceMap.mappedDocument, getPreferences, getFormatOptions);
				const symbols = dummyTsLs.findDocumentSymbols(sourceMap.mappedDocument.uri);
				result = result.concat(transformSymbolInformations(symbols, loc => {
					const vueRange = sourceMap.getSourceRange(loc.range.start, loc.range.end)?.[0];
					return vueRange ? vscode.Location.create(document.uri, vueRange) : undefined;
				}));
			}
			result = result.filter(symbol => {

				if (symbol.kind === vscode.SymbolKind.Module)
					return false;

				if (symbol.location.range.end.line === 0 && symbol.location.range.end.character === 0)
					return false;

				return true;
			});
			return dedupe.withSymbolInformations(result);
		}
		function getHtmlResult(sourceFile: SourceFile) {
			let result: vscode.SymbolInformation[] = [];
			for (const sourceMap of sourceFile.getTemplateSourceMaps()) {

				const htmlDocument = getHtmlDocument(sourceMap.mappedDocument);
				const pugDocument = getPugDocument(sourceMap.mappedDocument);
				const symbols =
					htmlDocument ? htmlLs.findDocumentSymbols(sourceMap.mappedDocument, htmlDocument)
						: pugDocument ? pugLs.findDocumentSymbols(pugDocument)
							: undefined

				if (!symbols) continue;
				result = result.concat(transformSymbolInformations(symbols, loc => {
					const vueRange = sourceMap.getSourceRange(loc.range.start, loc.range.end)?.[0];
					return vueRange ? vscode.Location.create(document.uri, vueRange) : undefined;
				}));
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: vscode.SymbolInformation[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {

				const stylesheet = getStylesheet(sourceMap.mappedDocument);
				const cssLs = getCssLs(sourceMap.mappedDocument.languageId);

				if (!cssLs || !stylesheet)
					continue;

				let symbols = cssLs.findDocumentSymbols(sourceMap.mappedDocument, stylesheet);
				if (!symbols) continue;
				result = result.concat(transformSymbolInformations(symbols, loc => {
					const vueRange = sourceMap.getSourceRange(loc.range.start, loc.range.end)?.[0];
					return vueRange ? vscode.Location.create(document.uri, vueRange) : undefined;
				}));
			}
			return result;
		}
	}
}

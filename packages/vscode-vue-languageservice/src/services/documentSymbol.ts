import { notEmpty } from '@volar/shared';
import {
	Location,
	Range,
	SymbolInformation,
	SymbolKind
} from 'vscode-languageserver/node';
import type { SourceFile } from '../sourceFile';
import type { TsApiRegisterOptions } from '../types';
import * as languageServices from '../utils/languageServices';

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {
	return (uri: string) => {
		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile) return;

		const document = sourceFile.getTextDocument();
		const vueResult = getVueResult(sourceFile);
		const tsResult = getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = getCssResult(sourceFile);
		// TODO: pug

		return [
			...vueResult,
			...tsResult,
			...htmlResult,
			...cssResult,
		];

		function getVueResult(sourceFile: SourceFile) {

			const result: SymbolInformation[] = [];
			const desc = sourceFile.getDescriptor();

			if (desc.template) {
				result.push({
					name: '<template>',
					kind: SymbolKind.Module,
					location: Location.create(uri, Range.create(
						document.positionAt(desc.template.loc.start),
						document.positionAt(desc.template.loc.end),
					)),
				});
			}
			if (desc.script) {
				result.push({
					name: '<script>',
					kind: SymbolKind.Module,
					location: Location.create(uri, Range.create(
						document.positionAt(desc.script.loc.start),
						document.positionAt(desc.script.loc.end),
					)),
				});
			}
			if (desc.scriptSetup) {
				result.push({
					name: '<script setup>',
					kind: SymbolKind.Module,
					location: Location.create(uri, Range.create(
						document.positionAt(desc.scriptSetup.loc.start),
						document.positionAt(desc.scriptSetup.loc.end),
					)),
				});
			}
			for (const style of desc.styles) {
				result.push({
					name: `<${['style', style.scoped ? 'scoped' : undefined, style.module ? 'module' : undefined].filter(notEmpty).join(' ')}>`,
					kind: SymbolKind.Module,
					location: Location.create(uri, Range.create(
						document.positionAt(style.loc.start),
						document.positionAt(style.loc.end),
					)),
				});
			}
			for (const customBlock of desc.customBlocks) {
				result.push({
					name: `<${customBlock.type}>`,
					kind: SymbolKind.Module,
					location: Location.create(uri, Range.create(
						document.positionAt(customBlock.loc.start),
						document.positionAt(customBlock.loc.end),
					)),
				});
			}

			return result;
		}
		function getTsResult(sourceFile: SourceFile) {
			const result: SymbolInformation[] = [];
			const map = new Map<string, SymbolInformation>();

			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				if (!sourceMap.capabilities.documentSymbol) continue;
				let symbols = tsLanguageService.findWorkspaceSymbols(sourceMap.mappedDocument.uri);
				for (const s of symbols) {
					const vueRange = sourceMap.getSourceRange(s.location.range.start, s.location.range.end);
					if (vueRange) {
						map.set(`${sourceMap.mappedDocument.offsetAt(s.location.range.start)}:${sourceMap.mappedDocument.offsetAt(s.location.range.end)}:${s.kind}:${s.name}`, {
							...s,
							location: Location.create(uri, vueRange),
						});
					}
				}
			}

			for (const info of map.values()) {
				result.push(info);
			}

			return result;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: SymbolInformation[] = [];
			const sourceMaps = sourceFile.getHtmlSourceMaps();
			for (const sourceMap of sourceMaps) {
				let symbols = languageServices.html.findDocumentSymbols(sourceMap.mappedDocument, sourceMap.htmlDocument);
				if (!symbols) continue;
				for (const s of symbols) {
					const vueRange = sourceMap.getSourceRange(s.location.range.start, s.location.range.end);
					if (vueRange) {
						result.push({
							...s,
							location: Location.create(uri, vueRange),
						});
					}
				}
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			const result: SymbolInformation[] = [];
			const sourceMaps = sourceFile.getCssSourceMaps();
			for (const sourceMap of sourceMaps) {
				const cssLanguageService = languageServices.getCssLanguageService(sourceMap.mappedDocument.languageId);
				if (!cssLanguageService || !sourceMap.stylesheet) continue;
				let symbols = cssLanguageService.findDocumentSymbols(sourceMap.mappedDocument, sourceMap.stylesheet);
				if (!symbols) continue;
				for (const s of symbols) {
					const vueRange = sourceMap.getSourceRange(s.location.range.start, s.location.range.end);
					if (vueRange) {
						result.push({
							...s,
							location: Location.create(uri, vueRange),
						});
					}
				}
			}
			return result;
		}
	}
}

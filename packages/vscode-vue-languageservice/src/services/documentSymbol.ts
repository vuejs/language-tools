import type { TsApiRegisterOptions } from '../types';
import {
	SymbolInformation,
	SymbolKind,
	Location,
	Range,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFile';
import * as languageServices from '../utils/languageServices';
import { notEmpty } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ sourceFiles, tsLanguageService }: TsApiRegisterOptions) {
	return (document: TextDocument) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

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
					location: Location.create(document.uri, Range.create(
						document.positionAt(desc.template.loc.start),
						document.positionAt(desc.template.loc.end),
					)),
				});
			}
			if (desc.script) {
				result.push({
					name: '<script>',
					kind: SymbolKind.Module,
					location: Location.create(document.uri, Range.create(
						document.positionAt(desc.script.loc.start),
						document.positionAt(desc.script.loc.end),
					)),
				});
			}
			if (desc.scriptSetup) {
				result.push({
					name: '<script setup>',
					kind: SymbolKind.Module,
					location: Location.create(document.uri, Range.create(
						document.positionAt(desc.scriptSetup.loc.start),
						document.positionAt(desc.scriptSetup.loc.end),
					)),
				});
			}
			for (const style of desc.styles) {
				result.push({
					name: `<${['style', style.scoped ? 'scoped' : undefined, style.module ? 'module' : undefined].filter(notEmpty).join(' ')}>`,
					kind: SymbolKind.Module,
					location: Location.create(document.uri, Range.create(
						document.positionAt(style.loc.start),
						document.positionAt(style.loc.end),
					)),
				});
			}
			for (const customBlock of desc.customBlocks) {
				result.push({
					name: `<${customBlock.type}>`,
					kind: SymbolKind.Module,
					location: Location.create(document.uri, Range.create(
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
				let symbols = tsLanguageService.findWorkspaceSymbols(sourceMap.targetDocument.uri);
				for (const s of symbols) {
					const vueLoc = sourceMap.targetToSource(s.location.range);
					if (vueLoc) {
						map.set(`${sourceMap.targetDocument.offsetAt(s.location.range.start)}:${sourceMap.targetDocument.offsetAt(s.location.range.end)}:${s.kind}:${s.name}`, {
							...s,
							location: Location.create(document.uri, vueLoc.range),
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
				let symbols = languageServices.html.findDocumentSymbols(sourceMap.targetDocument, sourceMap.htmlDocument);
				if (!symbols) continue;
				for (const s of symbols) {
					const vueLoc = sourceMap.targetToSource(s.location.range);
					if (vueLoc) {
						result.push({
							...s,
							location: Location.create(document.uri, vueLoc.range),
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
				const cssLanguageService = languageServices.getCssLanguageService(sourceMap.targetDocument.languageId);
				if (!cssLanguageService) continue;
				let symbols = cssLanguageService.findDocumentSymbols(sourceMap.targetDocument, sourceMap.stylesheet);
				if (!symbols) continue;
				for (const s of symbols) {
					const vueLoc = sourceMap.targetToSource(s.location.range);
					if (vueLoc) {
						result.push({
							...s,
							location: Location.create(document.uri, vueLoc.range),
						});
					}
				}
			}
			return result;
		}
	}
}

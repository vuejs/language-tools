import {
	TextDocument,
	SymbolInformation,
	SymbolKind,
	Location,
	Range,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import * as globalServices from '../globalServices';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const vueResult = getVueResult(sourceFile);
		const tsResult = getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = getCssResult(sourceFile);
		return [...vueResult, ...tsResult, ...htmlResult, ...cssResult];

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

			// if (desc.script) {
			// 	result.push({
			// 		name: '<script>',
			// 		kind: SymbolKind.Module,
			// 		location: Location.create(document.uri, Range.create(
			// 			document.positionAt(desc.script.loc.start),
			// 			document.positionAt(desc.script.loc.end),
			// 		)),
			// 	});
			// }

			for (const style of desc.styles) {
				result.push({
					name: '<style>',
					kind: SymbolKind.Module,
					location: Location.create(document.uri, Range.create(
						document.positionAt(style.loc.start),
						document.positionAt(style.loc.end),
					)),
				});
			}

			return result;
		}
		function getTsResult(sourceFile: SourceFile) {
			const result: SymbolInformation[] = [];
			const map = new Map<string, SymbolInformation>();

			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				let symbols = tsLanguageService.findWorkspaceSymbols(sourceMap.targetDocument.uri);
				for (const s of symbols) {
					const vueLoc = sourceMap.targetToSource(s.location.range);
					if (vueLoc) {
						map.set(`${sourceMap.targetDocument.offsetAt(s.location.range.start)}:${sourceMap.targetDocument.offsetAt(s.location.range.end)}:${s.kind}:${s.name}`, {
							...s,
							location: Location.create(document.uri, vueLoc.range),
							name: s.kind === SymbolKind.Module ? `<${vueLoc.maped.data.vueTag}>` : s.name,
							containerName: s.containerName ?? `<${vueLoc.maped.data.vueTag}>`,
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
				let symbols = globalServices.html.findDocumentSymbols(sourceMap.targetDocument, sourceMap.htmlDocument);
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
				const cssLanguageService = globalServices.getCssService(sourceMap.targetDocument.languageId);
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

import {
	TextDocument,
	SymbolInformation,
	SymbolKind,
	Location,
	Range,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';

export function register(sourceFiles: Map<string, SourceFile>) {
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
						document.positionAt(desc.template.loc.start.offset),
						document.positionAt(desc.template.loc.end.offset),
					)),
				});
			}

			// if (desc.script) {
			// 	result.push({
			// 		name: '<script>',
			// 		kind: SymbolKind.Module,
			// 		location: Location.create(document.uri, Range.create(
			// 			document.positionAt(desc.script.loc.start.offset),
			// 			document.positionAt(desc.script.loc.end.offset),
			// 		)),
			// 	});
			// }

			for (const style of desc.styles) {
				result.push({
					name: '<style>',
					kind: SymbolKind.Module,
					location: Location.create(document.uri, Range.create(
						document.positionAt(style.loc.start.offset),
						document.positionAt(style.loc.end.offset),
					)),
				});
			}

			return result;
		}
		function getTsResult(sourceFile: SourceFile) {
			const result: SymbolInformation[] = [];
			const map = new Map<string, SymbolInformation>();

			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				let symbols = sourceMap.languageService.findWorkspaceSymbols(sourceMap.targetDocument);
				for (const s of symbols) {
					const vueLoc = sourceMap.findSource(s.location.range);
					if (vueLoc) {
						map.set(`${sourceMap.targetDocument.offsetAt(s.location.range.start)}:${sourceMap.targetDocument.offsetAt(s.location.range.end)}:${s.kind}:${s.name}`, {
							...s,
							location: Location.create(document.uri, vueLoc.range),
							name: s.kind === SymbolKind.Module ? `<${vueLoc.data.vueTag}>` : s.name,
							containerName: s.containerName ?? `<${vueLoc.data.vueTag}>`,
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
				let symbols = sourceMap.languageService.findDocumentSymbols(sourceMap.targetDocument, sourceMap.htmlDocument);
				if (!symbols) continue;
				for (const s of symbols) {
					const vueLoc = sourceMap.findSource(s.location.range);
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
				let symbols = sourceMap.languageService.findDocumentSymbols(sourceMap.targetDocument, sourceMap.stylesheet);
				if (!symbols) continue;
				for (const s of symbols) {
					const vueLoc = sourceMap.findSource(s.location.range);
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

import {
	Position,
	TextDocument,
	Location
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import {
	getTsActionEntries,
	getSourceTsLocations,
	duplicateLocations,
	findSourceFileByTsUri,
} from '../utils/commons';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, position: Position) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const range = { start: position, end: position };
		const tsResult = getTsResult(sourceFile);
		const cssResult = getCssResult(sourceFile);
		const result = [...tsResult, ...cssResult];
		return duplicateLocations(result);

		function getTsResult(sourceFile: SourceFile) {
			let result: Location[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsLoc of sourceMap.findTargets(range)) {
					if (!tsLoc.data.capabilities.references) continue;
					const worker = sourceMap.languageService.findReferences;
					const entries = getTsActionEntries(sourceMap.targetDocument, tsLoc.range, tsLoc.data.vueTag, 'definition', worker, sourceMap.languageService, sourceFiles);
					for (const location of entries) {
						const document = sourceMap.languageService.getTextDocument(location.uri);
						if (!document) continue;
						const _result = worker(document, location.range.start);
						result = result.concat(_result);
					}
				}
			}
			if (document.languageId === 'typescript') {
				result = result.filter(loc => !findSourceFileByTsUri(sourceFiles, loc.uri)); // ignore typescript language service references
			}
			result = result.map(location => getSourceTsLocations(location, sourceFiles)).flat();
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: Location[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				for (const cssLoc of sourceMap.findTargets(range)) {
					const locations = sourceMap.languageService.findReferences(sourceMap.targetDocument, cssLoc.range.start, sourceMap.stylesheet);
					for (const location of locations) {
						const sourceLoc = sourceMap.findSource(location.range);
						if (sourceLoc) result.push({
							uri: sourceMap.sourceDocument.uri,
							range: sourceLoc.range,
						});
					}
				}
			}
			return result;
		}
	}
}

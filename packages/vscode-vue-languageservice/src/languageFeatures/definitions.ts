import {
	Position,
	TextDocument,
	Location,
	Range,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import {
	getTsActionEntries,
	getSourceTsLocations,
	duplicateLocations,
} from '../utils/commons';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, position: Position) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const tsResult = tsDefinitionWorker(sourceFile, position, sourceFiles, false);
		const cssResult = getCssResult(sourceFile);

		const result = [...tsResult, ...cssResult];
		return duplicateLocations(result);

		function getCssResult(sourceFile: SourceFile) {
			let result: Location[] = [];
			const sourceMaps = sourceFile.getCssSourceMaps();
			for (const sourceMap of sourceMaps) {
				const cssLocs = sourceMap.findTargets(Range.create(position, position));
				for (const virLoc of cssLocs) {
					const definition = sourceMap.languageService.findDefinition(sourceMap.targetDocument, virLoc.range.start, sourceMap.stylesheet);
					if (definition) {
						const vueLocs = getSourceTsLocations(definition, sourceFiles);
						result = result.concat(vueLocs);
					}
				}
			}
			return result;
		}
	}
}

export function tsDefinitionWorker(sourceFile: SourceFile, position: Position, sourceFiles: Map<string, SourceFile>, isTypeDefinition: boolean) {
	const range = {
		start: position,
		end: position,
	};
	let result: Location[] = [];
	for (const sourceMap of sourceFile.getTsSourceMaps()) {
		const ls = sourceMap.languageService;
		const worker = isTypeDefinition ? ls.findTypeDefinition : ls.findDefinition;
		for (const tsLoc of sourceMap.findTargets(range)) {
			if (!tsLoc.data.capabilities.references) continue;
			const entries = getTsActionEntries(sourceMap.targetDocument, tsLoc.range, tsLoc.data.vueTag, 'definition', worker, ls, sourceFiles);
			for (const location of entries) {
				const document = ls.getTextDocument(location.uri);
				if (!document) continue;
				const definitions = worker(document, location.range.start);
				result = result.concat(definitions);
			}
		}
	}
	result = result.map(location => getSourceTsLocations(location, sourceFiles)).flat();
	return result;
}

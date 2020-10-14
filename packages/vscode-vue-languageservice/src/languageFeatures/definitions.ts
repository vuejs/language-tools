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
import * as globalServices from '../globalServices';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument, position: Position) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const tsResult = tsDefinitionWorker(sourceFile, position, sourceFiles, false, tsLanguageService);
		const cssResult = getCssResult(sourceFile);

		const result = [...tsResult, ...cssResult];
		return duplicateLocations(result);

		function getCssResult(sourceFile: SourceFile) {
			let result: Location[] = [];
			const sourceMaps = sourceFile.getCssSourceMaps();
			for (const sourceMap of sourceMaps) {
				const cssLanguageService = sourceMap.virtualDocument.languageId === 'scss' ? globalServices.scss : globalServices.css;
				const cssLocs = sourceMap.findVirtualLocations(Range.create(position, position));
				for (const virLoc of cssLocs) {
					const definition = cssLanguageService.findDefinition(sourceMap.virtualDocument, virLoc.range.start, sourceMap.stylesheet);
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

export function tsDefinitionWorker(sourceFile: SourceFile, position: Position, sourceFiles: Map<string, SourceFile>, isTypeDefinition: boolean, tsLanguageService: ts2.LanguageService) {
	const range = {
		start: position,
		end: position,
	};
	let result: Location[] = [];
	for (const sourceMap of sourceFile.getTsSourceMaps()) {
		const worker = isTypeDefinition ? tsLanguageService.findTypeDefinition : tsLanguageService.findDefinition;
		for (const tsLoc of sourceMap.findVirtualLocations(range)) {
			if (!tsLoc.maped.data.capabilities.references) continue;
			const entries = getTsActionEntries(sourceMap.virtualDocument, tsLoc.range, tsLoc.maped.data.vueTag, 'definition', worker, tsLanguageService, sourceFiles);
			for (const location of entries) {
				const document = tsLanguageService.getTextDocument(location.uri);
				if (!document) continue;
				const definitions = worker(document, location.range.start);
				result = result.concat(definitions);
			}
		}
	}
	result = result.map(location => getSourceTsLocations(location, sourceFiles)).flat();
	return result;
}

import {
	Position,
	TextDocument,
	Location,
	Range,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import {
	findSourceFileByTsUri,
	tsLocationToVueLocations,
	duplicateLocations,
} from '../utils/commons';
import * as globalServices from '../globalServices';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import { SourceMap } from '../utils/sourceMaps';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument, position: Position) => {

		if (document.languageId !== 'vue') {
			const tsLocs = tsLanguageService.findDefinition(document, position);
			let result = tsLocs.map(tsLoc => tsLocationToVueLocations(tsLoc, sourceFiles)).flat();
			result = result.filter(loc => sourceFiles.has(loc.uri)); // duplicate
			return result;
		}

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
				const cssLanguageService = globalServices.getCssService(sourceMap.targetDocument.languageId);
				const cssLocs = sourceMap.sourceToTargets(Range.create(position, position));
				for (const virLoc of cssLocs) {
					const definition = cssLanguageService.findDefinition(sourceMap.targetDocument, virLoc.range.start, sourceMap.stylesheet);
					if (definition) {
						const vueLocs = tsLocationToVueLocations(definition, sourceFiles);
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
		for (const tsLoc of sourceMap.sourceToTargets(range)) {
			if (!tsLoc.maped.data.capabilities.references) continue;
			const definitions = worker(sourceMap.targetDocument, tsLoc.range.start);
			const vueDefinitions = definitions.map(location => tsLocationToVueLocations(location, sourceFiles)).flat();
			if (vueDefinitions.length) {
				result = result.concat(vueDefinitions);
			}
			else {
				for (const reference of definitions) {
					const sourceFile_2 = findSourceFileByTsUri(sourceFiles, reference.uri);
					const tsm = sourceFile_2?.getMirrorsSourceMaps();
					if (tsm?.contextSourceMap?.sourceDocument.uri === reference.uri)
						transfer(tsm.contextSourceMap);
					if (tsm?.componentSourceMap?.sourceDocument.uri === reference.uri)
						transfer(tsm.componentSourceMap);
					if (tsm?.scriptSetupSourceMap?.sourceDocument.uri === reference.uri)
						transfer(tsm.scriptSetupSourceMap);
					function transfer(sourceMap: SourceMap) {
						const leftRange = sourceMap.isSource(reference.range)
							? reference.range
							: sourceMap.targetToSource(reference.range)?.range;
						if (leftRange) {
							const rightLocs = sourceMap.sourceToTargets(leftRange);
							for (const rightLoc of rightLocs) {
								const definitions = worker(sourceMap.sourceDocument, rightLoc.range.start);
								const vueDefinitions = definitions.map(location => tsLocationToVueLocations(location, sourceFiles)).flat();
								result = result.concat(vueDefinitions);
								if (definitions.length) {
									break;
								}
							}
						}
					}
				}
			}
		}
	}
	return result;
}

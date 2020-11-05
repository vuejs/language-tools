import {
	Position,
	TextDocument,
	Location,
	Range,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import {
	tsLocationToVueLocations,
	duplicateLocations,
	findSourceFileByTsUri,
} from '../utils/commons';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import * as globalServices from '../globalServices';
import { SourceMap } from '../utils/sourceMaps';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument, position: Position) => {
		const range = { start: position, end: position };

		if (document.languageId !== 'vue') {
			let result = getTsResultWorker(document, range);
			result = result.filter(loc => sourceFiles.has(loc.uri)); // duplicate
			return duplicateLocations(result);
		}

		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const tsResult = getTsResult(sourceFile);
		const cssResult = getCssResult(sourceFile);
		const result = [...tsResult, ...cssResult];
		return duplicateLocations(result);

		function getTsResult(sourceFile: SourceFile) {
			let result: Location[] = [];
			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsLoc of sourceMap.sourceToTargets(range)) {
					if (!tsLoc.maped.data.capabilities.references) continue;
					result = result.concat(getTsResultWorker(sourceMap.targetDocument, tsLoc.range));
				}
			}
			return result;
		}
		function getTsResultWorker(tsDoc: TextDocument, tsRange: Range) {
			const tsLocations: Location[] = [];
			worker(tsDoc, tsRange.start);
			return tsLocations.map(tsLoc => tsLocationToVueLocations(tsLoc, sourceFiles)).flat();

			function worker(doc: TextDocument, pos: Position) {
				const references = tsLanguageService.findReferences(doc, pos);
				for (const reference of references) {
					if (hasLocation(reference)) continue;
					tsLocations.push(reference);
					const sourceFile_2 = findSourceFileByTsUri(sourceFiles, reference.uri);
					const templateScript = sourceFile_2?.getTemplateScript();
					if (templateScript?.document && templateScript?.document.uri === reference.uri) {
						if (templateScript.contextSourceMap)
							transfer(templateScript.contextSourceMap, templateScript.document);
						if (templateScript.componentSourceMap)
							transfer(templateScript.componentSourceMap, templateScript.document);
						function transfer(sourceMap: SourceMap, tsDocument: TextDocument) {
							const leftRange = sourceMap.isSource(reference.range)
								? reference.range
								: sourceMap.targetToSource(reference.range)?.range;
							if (leftRange) {
								const leftLoc = { uri: tsDocument.uri, range: leftRange };
								if (!hasLocation(leftLoc)) {
									worker(tsDocument, leftLoc.range.start);
								}
								const rightLocs = sourceMap.sourceToTargets(leftRange);
								for (const rightLoc of rightLocs) {
									const rightLoc_2 = { uri: tsDocument.uri, range: rightLoc.range };
									if (!hasLocation(rightLoc_2)) {
										worker(tsDocument, rightLoc_2.range.start);
									}
								}
							}
						}
					}
				}
			}
			// TODO: use map
			function hasLocation(loc: Location) {
				return tsLocations.find(tsLoc =>
					tsLoc.uri === loc.uri
					&& tsLoc.range.start.line === loc.range.start.line
					&& tsLoc.range.start.character === loc.range.start.character
					&& tsLoc.range.end.line === loc.range.end.line
					&& tsLoc.range.end.character === loc.range.end.character
				)
			}
		}
		function getCssResult(sourceFile: SourceFile) {
			let result: Location[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssLanguageService = globalServices.getCssService(sourceMap.targetDocument.languageId);
				for (const cssLoc of sourceMap.sourceToTargets(range)) {
					const locations = cssLanguageService.findReferences(sourceMap.targetDocument, cssLoc.range.start, sourceMap.stylesheet);
					for (const location of locations) {
						const sourceLoc = sourceMap.targetToSource(location.range);
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

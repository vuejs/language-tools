import type { ApiLanguageServiceContext } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { Location } from 'vscode-languageserver/node';
import * as dedupe from '../utils/dedupe';

export function register({ sourceFiles, getCssLs, getTsLs }: ApiLanguageServiceContext) {

	return (uri: string, position: Position) => {

		const tsResult = onTs(uri, position)
		const cssResult = onCss(uri, position);

		return dedupe.withLocations([
			...tsResult,
			...cssResult,
		]);
	}

	function onTs(uri: string, position: Position) {

		const loopChecker = dedupe.createLocationSet();
		let vueResult: Location[] = [];

		// vue -> ts
		for (const tsLoc of sourceFiles.toTsLocations(uri, position)) {

			if (tsLoc.type === 'embedded-ts' && !tsLoc.range.data.capabilities.references)
				continue;

			const tsLs = getTsLs(tsLoc.lsType);
			let tsResult: Location[] = [];
			withTeleports(tsLoc.uri, tsLoc.range.start);

			// ts -> vue
			for (const tsLoc_2 of tsResult) {
				for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc_2.uri, tsLoc_2.range.start, tsLoc_2.range.end)) {
					vueResult.push({
						uri: vueLoc.uri,
						range: vueLoc.range,
					});
				}
			}

			function withTeleports(uri: string, position: Position) {

				const tsLocs = tsLs.findReferences(
					uri,
					position,
				);
				tsResult = tsResult.concat(tsLocs);

				for (const tsLoc_2 of tsLocs) {
					loopChecker.add({ uri: tsLoc_2.uri, range: tsLoc_2.range });
					const teleport = sourceFiles.getTsTeleports(tsLoc.lsType).get(tsLoc_2.uri);
					if (teleport) {
						for (const teleRange of teleport.findTeleports(tsLoc_2.range.start, tsLoc_2.range.end)) {
							if (!teleRange.sideData.capabilities.references)
								continue;
							if (loopChecker.has({ uri: tsLoc_2.uri, range: teleRange }))
								continue;
							withTeleports(tsLoc_2.uri, teleRange.start);
						}
					}
				}
			}
		}

		return vueResult;
	}
	function onCss(uri: string, position: Position) {

		let cssResult: Location[] = [];
		let vueResult: Location[] = [];

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile)
			return vueResult;

		// vue -> css
		for (const sourceMap of sourceFile.getCssSourceMaps()) {

			if (!sourceMap.stylesheet)
				continue;

			const cssLs = getCssLs(sourceMap.mappedDocument.languageId);
			if (!cssLs)
				continue;

			for (const cssRange of sourceMap.getMappedRanges(position)) {
				const cssLocs = cssLs.findReferences(
					sourceMap.mappedDocument,
					cssRange.start,
					sourceMap.stylesheet,
				);
				cssResult = cssResult.concat(cssLocs);
			}
		}

		// css -> vue
		for (const cssLoc of cssResult) {

			const sourceMap = sourceFiles.getCssSourceMaps().get(cssLoc.uri);
			if (!sourceMap)
				continue;

			for (const vueRange of sourceMap.getSourceRanges(cssLoc.range.start, cssLoc.range.end)) {
				vueResult.push({
					uri: sourceMap.sourceDocument.uri,
					range: vueRange,
				});
			}
		}

		return vueResult;
	}
}

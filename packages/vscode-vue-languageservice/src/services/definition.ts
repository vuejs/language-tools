import type { LocationLink, Position, Range } from 'vscode-languageserver/node';
import type { Location } from 'vscode-languageserver/node';
import type { ApiLanguageServiceContext } from '../types';
import * as dedupe from '../utils/dedupe';

export function register({ sourceFiles, getCssLs, tsLs }: ApiLanguageServiceContext) {

	return {
		on: (uri: string, position: Position) => {

			const tsResult = onTs(uri, position, 'definition');
			if (tsResult.length) {
				return dedupe.withLocationLinks([
					...tsResult,
				]);
			}

			const cssResult = onCss(uri, position);
			return dedupe.withLocations([
				...cssResult,
			]);
		},
		onType: (uri: string, position: Position) => {

			const tsResult = onTs(uri, position, 'typeDefinition');

			return dedupe.withLocationLinks([
				...tsResult,
			]);
		},
	};

	function onTs(uri: string, position: Position, mode: 'definition' | 'typeDefinition') {

		const loopChecker = dedupe.createLocationSet();
		let tsResult: (LocationLink & { originalUri: string, isOriginal: boolean })[] = [];
		let vueResult: LocationLink[] = [];

		// vue -> ts
		for (const tsLoc of sourceFiles.toTsLocations(uri, position)) {

			if (tsLoc.type === 'embedded-ts' && !tsLoc.range.data.capabilities.definitions)
				continue;

			withTeleports(tsLoc.uri, tsLoc.range.start, true);

			function withTeleports(uri: string, position: Position, isOriginal: boolean) {

				const tsLocs = mode === 'typeDefinition'
					? tsLs.findTypeDefinition(uri, position)
					: tsLs.findDefinition(uri, position);

				tsResult = tsResult.concat(tsLocs.map(tsLoc => ({
					...tsLoc,
					originalUri: uri,
					isOriginal,
				})));

				for (const location of tsLocs) {
					loopChecker.add({ uri: location.targetUri, range: location.targetSelectionRange });
					const teleport = sourceFiles.getTsTeleports().get(location.targetUri);
					if (teleport) {
						for (const teleRange of teleport.findTeleports(location.targetSelectionRange.start, location.targetSelectionRange.end)) {
							if (!teleRange.sideData.capabilities.definitions)
								continue;
							if (loopChecker.has({ uri: location.targetUri, range: teleRange }))
								continue;
							withTeleports(location.targetUri, teleRange.start, false);
						}
					}
				}
			}
		}

		// ts -> vue
		let originSelectionRange: Range | undefined;
		for (const tsLoc of tsResult) {
			if (tsLoc.isOriginal && tsLoc.originSelectionRange) {
				for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.originalUri, tsLoc.originSelectionRange.start, tsLoc.originSelectionRange.end)) {
					originSelectionRange = vueLoc.range;
					break;
				}
			}
		}
		for (const tsLoc of tsResult) {
			for (const targetSelectionRange of sourceFiles.fromTsLocation(tsLoc.targetUri, tsLoc.targetSelectionRange.start, tsLoc.targetSelectionRange.end)) {
				for (const targetRange of sourceFiles.fromTsLocation(tsLoc.targetUri, tsLoc.targetRange.start, tsLoc.targetRange.end)) {
					vueResult.push({
						targetUri: targetSelectionRange.uri,
						targetRange: targetRange.range,
						targetSelectionRange: targetSelectionRange.range,
						originSelectionRange,
					});
					break;
				}
				break;
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
				const cssLoc = cssLs.findDefinition(
					sourceMap.mappedDocument,
					cssRange.start,
					sourceMap.stylesheet,
				);
				if (cssLoc) {
					cssResult.push(cssLoc);
				}
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

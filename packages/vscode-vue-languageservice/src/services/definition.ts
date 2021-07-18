import type * as vscode from 'vscode-languageserver';
import type { ApiLanguageServiceContext } from '../types';
import * as dedupe from '../utils/dedupe';

export function register({ sourceFiles, getCssLs, getTsLs }: ApiLanguageServiceContext) {

	return {
		on: (uri: string, position: vscode.Position) => {

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
		onType: (uri: string, position: vscode.Position) => {

			const tsResult = onTs(uri, position, 'typeDefinition');

			return dedupe.withLocationLinks([
				...tsResult,
			]);
		},
	};

	function onTs(uri: string, position: vscode.Position, mode: 'definition' | 'typeDefinition') {

		const loopChecker = dedupe.createLocationSet();
		let vueResult: vscode.LocationLink[] = [];

		// vue -> ts
		for (const tsLoc of sourceFiles.toTsLocations(uri, position)) {

			if (tsLoc.type === 'embedded-ts' && !tsLoc.range.data.capabilities.definitions)
				continue;

			const tsLs = getTsLs(tsLoc.lsType);
			let tsResult: (vscode.LocationLink & { originalUri: string, isOriginal: boolean })[] = [];
			withTeleports(tsLoc.uri, tsLoc.range.start, true);

			// ts -> vue
			for (const tsLoc_2 of tsResult) {

				let targetUri: string | undefined;
				let targetRange: vscode.Range | undefined;
				let targetSelectionRange: vscode.Range | undefined;
				let originSelectionRange: vscode.Range | undefined;

				if (tsLoc_2.originSelectionRange) {
					for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc_2.originalUri, tsLoc_2.originSelectionRange.start, tsLoc_2.originSelectionRange.end)) {
						originSelectionRange = vueLoc.range;
						break;
					}
				}

				for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc_2.targetUri, tsLoc_2.targetRange.start, tsLoc_2.targetRange.end)) {
					targetUri = vueLoc.uri;
					targetRange = vueLoc.range;
					break;
				}

				for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc_2.targetUri, tsLoc_2.targetSelectionRange.start, tsLoc_2.targetSelectionRange.end)) {
					targetUri = vueLoc.uri;
					targetSelectionRange = vueLoc.range;
					break;
				}

				if (targetUri && (targetRange || targetSelectionRange)) {
					vueResult.push({
						targetUri,
						targetRange: (targetRange ?? targetSelectionRange)!,
						targetSelectionRange: (targetSelectionRange ?? targetRange)!,
						originSelectionRange,
					});
				}
			}

			function withTeleports(uri: string, position: vscode.Position, isOriginal: boolean) {

				if (loopChecker.has({ uri: uri, range: { start: position, end: position } }))
					return;
				loopChecker.add({ uri: uri, range: { start: position, end: position } });

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
					const teleport = sourceFiles.getTsTeleports(tsLoc.lsType).get(location.targetUri);
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

		return vueResult;
	}
	function onCss(uri: string, position: vscode.Position) {

		let cssResult: vscode.Location[] = [];
		let vueResult: vscode.Location[] = [];

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

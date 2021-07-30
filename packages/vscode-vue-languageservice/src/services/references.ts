import type { ApiLanguageServiceContext } from '../types';
import type * as vscode from 'vscode-languageserver';
import * as dedupe from '../utils/dedupe';

export function register({ sourceFiles, getCssLs, getTsLs }: ApiLanguageServiceContext) {

	return (uri: string, position: vscode.Position) => {

		const tsResult = onTs(uri, position)
		const cssResult = onCss(uri, position);

		return dedupe.withLocations([
			...tsResult,
			...cssResult,
		]);
	}

	function onTs(uri: string, position: vscode.Position) {

		let vueResult: vscode.Location[] = [];

		// vue -> ts
		for (const tsLoc of sourceFiles.toTsLocations(uri, position)) {

			if (tsLoc.type === 'embedded-ts' && !tsLoc.range.data.capabilities.references)
				continue;

			const loopChecker = dedupe.createLocationSet();
			const tsLs = getTsLs(tsLoc.lsType);
			let tsResult: vscode.Location[] = [];
			withTeleports(tsLoc.uri, tsLoc.range.start);

			// ts -> vue
			for (const tsLoc_2 of tsResult) {
				for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc_2.uri, tsLoc_2.range.start, tsLoc_2.range.end)) {

					if (vueLoc.type === 'embedded-ts' && !vueLoc.range.data.capabilities.references)
						continue;

					if (vueLoc.type === 'source-ts' && tsLoc.lsType === 'template')
						continue;

					vueResult.push({
						uri: vueLoc.uri,
						range: vueLoc.range,
					});
				}
			}

			function withTeleports(uri: string, position: vscode.Position) {

				if (loopChecker.has({ uri: uri, range: { start: position, end: position } }))
					return;
				loopChecker.add({ uri: uri, range: { start: position, end: position } });

				const tsLocs = tsLs.findReferences(
					uri,
					position,
				);
				tsResult = tsResult.concat(tsLocs);

				for (const tsLoc_2 of tsLocs) {
					loopChecker.add({ uri: tsLoc_2.uri, range: tsLoc_2.range });
					const teleport = sourceFiles.getTsTeleports(tsLoc.lsType).get(tsLoc_2.uri);

					if (!teleport)
						continue;

					if (
						!teleport.allowCrossFile
						&& sourceFiles.getSourceFileByTsUri(tsLoc.lsType, tsLoc_2.uri) !== sourceFiles.getSourceFileByTsUri(tsLoc.lsType, uri)
					) continue;

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

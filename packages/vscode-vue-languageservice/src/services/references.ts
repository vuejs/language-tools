import type { LanguageServiceRuntimeContext } from '../types';
import type * as vscode from 'vscode-languageserver-protocol';
import * as dedupe from '../utils/dedupe';

export function register({ vueDocuments: sourceFiles, getCssLs, getTsLs, getStylesheet }: LanguageServiceRuntimeContext) {

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
		for (const tsLoc of sourceFiles.toEmbeddedLocation(
			uri,
			position,
			position,
			data => !!data.capabilities.references,
		)) {

			if (tsLoc.lsType === undefined)
				continue;

			const loopChecker = dedupe.createLocationSet();
			const tsLs = getTsLs(tsLoc.lsType);
			let tsResult: vscode.Location[] = [];
			withTeleports(tsLoc.uri, tsLoc.range.start);

			// ts -> vue
			for (const tsLoc_2 of tsResult) {
				for (const vueLoc of sourceFiles.fromEmbeddedLocation(
					tsLoc.lsType,
					tsLoc_2.uri,
					tsLoc_2.range.start,
					tsLoc_2.range.end,
					data => !!data.capabilities.references,
				)) {
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

				for (const tsLoc_2 of tsLs.findReferences(
					uri,
					position,
				)) {
					loopChecker.add({ uri: tsLoc_2.uri, range: tsLoc_2.range });
					const teleport = sourceFiles.getTsTeleports(tsLoc.lsType!).get(tsLoc_2.uri);

					if (!teleport) {
						tsResult.push(tsLoc_2);
						continue;
					}

					let foundTeleport = false;

					for (const [teleRange] of teleport.findTeleports(
						tsLoc_2.range.start,
						tsLoc_2.range.end,
						sideData => !!sideData.capabilities.references,
					)) {
						foundTeleport = true;
						if (loopChecker.has({ uri: tsLoc_2.uri, range: teleRange }))
							continue;
						withTeleports(tsLoc_2.uri, teleRange.start);
					}

					if (!foundTeleport) {
						tsResult.push(tsLoc_2);
						continue;
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

			const stylesheet = getStylesheet(sourceMap.mappedDocument);
			const cssLs = getCssLs(sourceMap.mappedDocument.languageId);

			if (!cssLs || !stylesheet)
				continue;

			for (const [cssRange] of sourceMap.getMappedRanges(position)) {
				const cssLocs = cssLs.findReferences(
					sourceMap.mappedDocument,
					cssRange.start,
					stylesheet,
				);
				cssResult = cssResult.concat(cssLocs);
			}
		}

		// css -> vue
		for (const cssLoc of cssResult) {

			const sourceMap = sourceFiles.fromEmbeddedDocumentUri(undefined, cssLoc.uri);
			if (!sourceMap)
				continue;

			for (const [vueRange] of sourceMap.getSourceRanges(cssLoc.range.start, cssLoc.range.end)) {
				vueResult.push({
					uri: sourceMap.sourceDocument.uri,
					range: vueRange,
				});
			}
		}

		return vueResult;
	}
}

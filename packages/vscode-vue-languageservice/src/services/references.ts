import type { ApiLanguageServiceContext } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { Location } from 'vscode-languageserver/node';
import * as dedupe from '../utils/dedupe';

export function register({ mapper, getCssLs }: ApiLanguageServiceContext) {

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
		let tsResult: Location[] = [];
		let vueResult: Location[] = [];

		// vue -> ts
		for (const tsRange of mapper.ts.to(uri, position)) {

			if (!tsRange.data.capabilities.references)
				continue;

			withTeleports(tsRange.textDocument.uri, tsRange.range.start);

			function withTeleports(uri: string, position: Position) {

				const tsLocs = tsRange.languageService.findReferences(
					uri,
					position,
				);
				tsResult = tsResult.concat(tsLocs);

				for (const tsLoc of tsLocs) {
					loopChecker.add({ uri: tsLoc.uri, range: tsLoc.range });
					for (const teleRange of mapper.ts.teleports(tsLoc.uri, tsLoc.range.start, tsLoc.range.end)) {
						if (!teleRange.sideData.capabilities.references)
							continue;
						if (loopChecker.has({ uri: tsLoc.uri, range: teleRange }))
							continue;
						withTeleports(tsLoc.uri, teleRange.start);
					}
				}
			}
		}

		// ts -> vue
		for (const tsLoc of tsResult) {
			for (const vueRange of mapper.ts.from(tsLoc.uri, tsLoc.range.start, tsLoc.range.end)) {
				vueResult.push({
					uri: vueRange.textDocument.uri,
					range: vueRange.range,
				});
			}
		}

		return vueResult;
	}
	function onCss(uri: string, position: Position) {

		let cssResult: Location[] = [];
		let vueResult: Location[] = [];

		// vue -> css
		for (const cssRange of mapper.css.to(uri, position)) {
			const cssLs = getCssLs(cssRange.textDocument.languageId);
			if (!cssLs) continue;
			const cssLocs = cssLs.findReferences(
				cssRange.textDocument,
				cssRange.range.start,
				cssRange.stylesheet,
			);
			cssResult = cssResult.concat(cssLocs);
		}

		// css -> vue
		for (const cssLoc of cssResult) {
			for (const vueRange of mapper.css.from(cssLoc.uri, cssLoc.range.start, cssLoc.range.end)) {
				vueResult.push({
					uri: vueRange.textDocument.uri,
					range: vueRange.range,
				});
			}
		}

		return vueResult;
	}
}

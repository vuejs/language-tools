import type { Position } from 'vscode-languageserver/node';
import type { Location } from 'vscode-languageserver/node';
import type { TsApiRegisterOptions } from '../types';
import * as dedupe from '../utils/dedupe';

export function register({ mapper }: TsApiRegisterOptions) {

	return {
		on: (uri: string, position: Position) => {

			const tsResult = onTs(uri, position, 'definition');
			const cssResult = onCss(uri, position);

			return dedupe.withLocations([
				...tsResult,
				...cssResult,
			]);
		},
		onType: (uri: string, position: Position) => {

			const tsResult = onTs(uri, position, 'typeDefinition');

			return dedupe.withLocations([
				...tsResult,
			]);
		},
	};

	function onTs(uri: string, position: Position, mode: 'definition' | 'typeDefinition') {

		const loopChecker = dedupe.createLocationSet();
		let tsResult: Location[] = [];
		let vueResult: Location[] = [];

		// vue -> ts
		for (const tsRange of mapper.ts.to(uri, position)) {

			if (!tsRange.data.capabilities.definitions)
				continue;

			withTeleports(tsRange.textDocument.uri, tsRange.start);

			function withTeleports(uri: string, position: Position) {

				const tsLocs = mode === 'typeDefinition'
					? tsRange.languageService.findTypeDefinition(uri, position)
					: tsRange.languageService.findDefinition(uri, position);

				tsResult = tsResult.concat(tsLocs);

				for (const location of tsLocs) {
					loopChecker.add({ uri: location.uri, range: location.range });
					for (const teleRange of mapper.ts.teleports(location.uri, location.range.start, location.range.end)) {
						if (!teleRange.sideData.capabilities.definitions)
							continue;
						if (loopChecker.has({ uri: location.uri, range: teleRange }))
							continue;
						withTeleports(location.uri, teleRange.start);
					}
				}
			}
		}

		// ts -> vue
		for (const tsLoc of tsResult) {
			for (const vueRange of mapper.ts.from(tsLoc.uri, tsLoc.range.start, tsLoc.range.end)) {
				vueResult.push({
					uri: vueRange.textDocument.uri,
					range: vueRange,
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
			const cssLoc = cssRange.languageService.findDefinition(
				cssRange.textDocument,
				cssRange.start,
				cssRange.stylesheet,
			);
			if (cssLoc) {
				cssResult.push(cssLoc);
			}
		}

		// css -> vue
		for (const cssLoc of cssResult) {
			for (const vueRange of mapper.css.from(cssLoc.uri, cssLoc.range.start, cssLoc.range.end)) {
				vueResult.push({
					uri: vueRange.textDocument.uri,
					range: vueRange,
				});
			}
		}

		return vueResult;
	}
}

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
		for (const tsMaped of mapper.ts.to(uri, { start: position, end: position })) {

			if (!tsMaped.data.capabilities.definitions)
				continue;

			withTeleports(tsMaped.textDocument.uri, tsMaped.range.start);

			function withTeleports(uri: string, position: Position) {

				const tsLocs = mode === 'typeDefinition'
					? tsMaped.languageService.findTypeDefinition(uri, position)
					: tsMaped.languageService.findDefinition(uri, position);

				tsResult = tsResult.concat(tsLocs);

				for (const location of tsLocs) {
					loopChecker.add({ uri: location.uri, range: location.range });
					for (const teleport of mapper.ts.teleports(location.uri, location.range)) {
						if (!teleport.sideData.capabilities.definitions)
							continue;
						if (loopChecker.has({ uri: location.uri, range: teleport.range }))
							continue;
						withTeleports(location.uri, teleport.range.start);
					}
				}
			}
		}

		// ts -> vue
		for (const tsLoc of tsResult) {
			for (const vueMaped of mapper.ts.from(tsLoc.uri, tsLoc.range)) {
				vueResult.push({
					uri: vueMaped.textDocument.uri,
					range: vueMaped.range,
				});
			}
		}

		return vueResult;
	}
	function onCss(uri: string, position: Position) {

		let cssResult: Location[] = [];
		let vueResult: Location[] = [];

		// vue -> css
		for (const cssMaped of mapper.css.to(uri, { start: position, end: position })) {
			const cssLoc = cssMaped.languageService.findDefinition(
				cssMaped.textDocument,
				cssMaped.range.start,
				cssMaped.stylesheet,
			);
			if (cssLoc) {
				cssResult.push(cssLoc);
			}
		}

		// css -> vue
		for (const cssLoc of cssResult) {
			for (const vueMaped of mapper.css.from(cssLoc.uri, cssLoc.range)) {
				vueResult.push({
					uri: vueMaped.textDocument.uri,
					range: vueMaped.range,
				});
			}
		}

		return vueResult;
	}
}

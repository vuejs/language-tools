import type { LocationLink, Position, Range } from 'vscode-languageserver/node';
import type { Location } from 'vscode-languageserver/node';
import type { TsApiRegisterOptions } from '../types';
import * as dedupe from '../utils/dedupe';

export function register({ mapper }: TsApiRegisterOptions) {

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
		for (const tsRange of mapper.ts.to(uri, position)) {

			if (!tsRange.data.capabilities.definitions)
				continue;

			withTeleports(tsRange.textDocument.uri, tsRange.start, true);

			function withTeleports(uri: string, position: Position, isOriginal: boolean) {

				const tsLocs = mode === 'typeDefinition'
					? tsRange.languageService.findTypeDefinition(uri, position)
					: tsRange.languageService.findDefinition(uri, position);

				tsResult = tsResult.concat(tsLocs.map(tsLoc => ({
					...tsLoc,
					originalUri: uri,
					isOriginal,
				})));

				for (const location of tsLocs) {
					loopChecker.add({ uri: location.targetUri, range: location.targetSelectionRange });
					for (const teleRange of mapper.ts.teleports(location.targetUri, location.targetSelectionRange.start, location.targetSelectionRange.end)) {
						if (!teleRange.sideData.capabilities.definitions)
							continue;
						if (loopChecker.has({ uri: location.targetUri, range: teleRange }))
							continue;
						withTeleports(location.targetUri, teleRange.start, false);
					}
				}
			}
		}

		// ts -> vue
		let originSelectionRange: Range | undefined;
		for (const tsLoc of tsResult) {
			if (tsLoc.isOriginal && tsLoc.originSelectionRange) {
				const ranges = mapper.ts.from(tsLoc.originalUri, tsLoc.originSelectionRange.start, tsLoc.originSelectionRange.end);
				if (ranges.length) {
					originSelectionRange = ranges[0];
				}
			}
		}
		for (const tsLoc of tsResult) {

			const targetSelectionRange = mapper.ts.from(tsLoc.targetUri, tsLoc.targetSelectionRange.start, tsLoc.targetSelectionRange.end);
			if (!targetSelectionRange.length) continue;

			const targetRange = mapper.ts.from(tsLoc.targetUri, tsLoc.targetRange.start, tsLoc.targetRange.end);

			vueResult.push({
				targetUri: targetSelectionRange[0].textDocument.uri,
				targetRange: targetRange.length ? targetRange[0] : targetSelectionRange[0],
				targetSelectionRange: targetSelectionRange[0],
				originSelectionRange,
			});
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

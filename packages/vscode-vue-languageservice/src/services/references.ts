import type { TsApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { Location } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as dedupe from '../utils/dedupe';

export function register({ mapper }: TsApiRegisterOptions) {

	return (document: TextDocument, position: Position) => {

		const tsResult = onTs(document.uri, position)
		const cssResult = onCss(document.uri, position);

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
		for (const tsMaped of mapper.ts.to(uri, { start: position, end: position })) {

			if (!tsMaped.data.capabilities.references)
				continue;

			withTeleports(tsMaped.textDocument.uri, tsMaped.range.start);

			function withTeleports(uri: string, position: Position) {

				const tsLocs = tsMaped.languageService.findReferences(
					uri,
					position,
				);
				tsResult = tsResult.concat(tsLocs);

				for (const tsLoc of tsLocs) {
					loopChecker.add({ uri: tsLoc.uri, range: tsLoc.range });
					for (const teleport of mapper.ts.teleports(tsLoc.uri, tsLoc.range)) {
						if (!teleport.sideData.capabilities.references)
							continue;
						if (loopChecker.has({ uri: tsLoc.uri, range: teleport.range }))
							continue;
						withTeleports(tsLoc.uri, teleport.range.start);
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
			const cssLocs = cssMaped.languageService.findReferences(
				cssMaped.textDocument,
				cssMaped.range.start,
				cssMaped.stylesheet,
			);
			cssResult = cssResult.concat(cssLocs);
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

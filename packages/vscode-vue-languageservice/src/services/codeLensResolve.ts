import type { ApiLanguageServiceContext } from '../types';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TsCodeLensData } from './codeLens';
import * as findReferences from './references';
import { Commands } from '../commands';

export function register({ sourceFiles, getTsLs }: ApiLanguageServiceContext) {

	const _findReferences = findReferences.register(arguments[0]);

	return (codeLens: vscode.CodeLens, canShowReferences?: boolean) => {

		// @ts-expect-error
		const data: TsCodeLensData = codeLens.data;
		const tsLs = getTsLs(data.lsType);
		const doc = data.uri ? sourceFiles.get(data.uri)?.getTextDocument() ?? tsLs.__internal__.getTextDocument(data.uri) : undefined;
		const tsDoc = data.tsUri ? tsLs.__internal__.getTextDocument(data.tsUri) : undefined;
		const sourceFile = data.uri ? sourceFiles.get(data.uri) : undefined;

		if (data.uri && doc && tsDoc && data.offset !== undefined && data.tsOffset !== undefined) {
			const pos = doc.positionAt(data.offset);
			const vueReferences = _findReferences(data.uri, pos);
			let references = vueReferences;
			if (sourceFile) {
				let isCssLocation = false;
				for (const cssSourceMap of sourceFile.getCssSourceMaps()) {
					if (cssSourceMap.getMappedRange(pos)) {
						isCssLocation = true;
					}
				}
				if (isCssLocation) {
					references = vueReferences?.filter(ref => {
						if (ref.uri === data.uri) {
							for (const cssSourceMap of sourceFile.getCssSourceMaps()) {
								if (cssSourceMap.getMappedRange(ref.range.start, ref.range.end)) {
									return false;
								}
							}
						}
						return true;
					});
				}
				else {
					references = vueReferences?.filter(ref => {
						if (ref.uri === data.uri) {
							return false;
						}
						return true;
					});
				}
			}
			else {
				references = vueReferences?.filter(ref => {
					if (ref.uri === data.uri) {
						return false;
					}
					return true;
				});
			}
			const referencesCount = references?.length ?? 0;
			codeLens.command = {
				title: referencesCount === 1 ? '1 reference' : `${referencesCount} references`,
				command: canShowReferences ? Commands.SHOW_REFERENCES : '',
				arguments: [data.uri, codeLens.range.start, vueReferences],
			};
		}

		return codeLens;
	}
}

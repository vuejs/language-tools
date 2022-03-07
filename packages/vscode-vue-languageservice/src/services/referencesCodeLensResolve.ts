import type { LanguageServiceRuntimeContext } from '../types';
import type * as vscode from 'vscode-languageserver-protocol';
import type { ReferencesCodeLensData } from './referencesCodeLens';
import * as findReferences from './references';

export function register({ vueDocuments, getTsLs }: LanguageServiceRuntimeContext) {

	const _findReferences = findReferences.register(arguments[0]);

	return (codeLens: vscode.CodeLens, showReferencesCommand?: string) => {

		// @ts-expect-error
		const data = codeLens.data as ReferencesCodeLensData;
		const tsLs = getTsLs(data.lsType);
		const doc = data.uri ? vueDocuments.get(data.uri)?.getTextDocument() ?? tsLs.__internal__.getTextDocument(data.uri) : undefined;
		const tsDoc = data.tsUri ? tsLs.__internal__.getTextDocument(data.tsUri) : undefined;
		const sourceFile = data.uri ? vueDocuments.get(data.uri) : undefined;

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
				command: showReferencesCommand ?? '',
				arguments: [data.uri, codeLens.range.start, vueReferences],
			};
		}

		return codeLens;
	}
}

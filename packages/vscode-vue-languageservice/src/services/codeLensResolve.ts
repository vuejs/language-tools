import type { ApiLanguageServiceContext } from '../types';
import type * as vscode from 'vscode-languageserver';
import type { TsCodeLensData } from './codeLens';
import * as findReferences from './references';
import { Commands } from '../commands';

export function register({ sourceFiles, getTsLs }: ApiLanguageServiceContext) {
	const _findReferences = findReferences.register(arguments[0]);
	return (codeLens: vscode.CodeLens, canShowReferences?: boolean) => {

		const data = codeLens.data as TsCodeLensData;
		const {
			lsType,
			uri,
			offset,
			tsUri,
			tsOffset,
		} = data;
		const tsLs = getTsLs(lsType);
		const doc = uri ? sourceFiles.get(uri)?.getTextDocument() ?? tsLs.__internal__.getTextDocument(uri) : undefined;
		const tsDoc = tsUri ? tsLs.__internal__.getTextDocument(tsUri) : undefined;
		const sourceFile = uri ? sourceFiles.get(uri) : undefined;

		if (uri && doc && tsDoc && offset !== undefined && tsOffset !== undefined) {
			const pos = doc.positionAt(offset);
			const vueReferences = _findReferences(uri, pos);
			let references = vueReferences;
			if (sourceFile) {
				let isCssLocation = false;
				for (const cssSourceMap of sourceFile.getCssSourceMaps()) {
					if (cssSourceMap.isSourceRange(pos)) {
						isCssLocation = true;
					}
				}
				if (isCssLocation) {
					references = vueReferences?.filter(ref => {
						if (ref.uri === uri) {
							for (const cssSourceMap of sourceFile.getCssSourceMaps()) {
								if (cssSourceMap.isSourceRange(ref.range.start, ref.range.end)) {
									return false;
								}
							}
						}
						return true;
					});
				}
				else {
					references = vueReferences?.filter(ref => {
						if (ref.uri === uri) {
							return false;
						}
						return true;
					});
				}
			}
			else {
				references = vueReferences?.filter(ref => {
					if (ref.uri === uri) {
						return false;
					}
					return true;
				});
			}
			const referencesCount = references?.length ?? 0;
			codeLens.command = {
				title: referencesCount === 1 ? '1 reference' : `${referencesCount} references`,
				command: Commands.SHOW_REFERENCES,
				arguments: [uri, codeLens.range.start, vueReferences],
			};
		}

		return codeLens;
	}
}

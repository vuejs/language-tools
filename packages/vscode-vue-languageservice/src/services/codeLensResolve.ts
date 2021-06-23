import type { ApiLanguageServiceContext } from '../types';
import {
	CodeLens,
} from 'vscode-languageserver/node';
import * as findReferences from './references';
import { Commands } from '../commands';

export function register({ sourceFiles, tsLs }: ApiLanguageServiceContext) {
	const _findReferences = findReferences.register(arguments[0]);
	return (codeLens: CodeLens) => {

		const uri: string | undefined = codeLens.data.uri;
		const offset: number | undefined = codeLens.data.offset;
		const tsUri: string | undefined = codeLens.data.tsUri;
		const tsOffset: number | undefined = codeLens.data.tsOffset;
		const doc = uri ? sourceFiles.get(uri)?.getTextDocument() ?? tsLs.__internal__.getTextDocument(uri) : undefined;
		const tsDoc = tsUri ? tsLs.__internal__.getTextDocument(tsUri) : undefined;
		const sourceFile = uri ? sourceFiles.get(uri) : undefined;

		if (uri && doc && tsDoc && offset !== undefined && tsOffset !== undefined) {
			const pos = doc.positionAt(offset);
			const tsPos = tsDoc.positionAt(tsOffset);
			const references0 = _findReferences(tsDoc.uri, tsPos);
			let references = references0;
			if (sourceFile) {
				let isCssLocation = false;
				for (const cssSourceMap of sourceFile.getCssSourceMaps()) {
					if (cssSourceMap.isSourceRange(pos)) {
						isCssLocation = true;
					}
				}
				if (isCssLocation) {
					references = references0?.filter(ref => {
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
					references = references0?.filter(ref => {
						if (ref.uri === uri) {
							return false;
						}
						return true;
					});
				}
			}
			else {
				references = references0?.filter(ref => {
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
				arguments: [uri, codeLens.range.start, references0],
			};
		}

		return codeLens;
	}
}

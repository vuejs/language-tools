import {
	CodeLens,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import * as findReferences from './references';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import { Commands } from '../commands';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	const _findReferences = findReferences.register(sourceFiles, tsLanguageService);
	return (codeLens: CodeLens) => {

		const uri: string | undefined = codeLens.data.uri;
		const tsUri: string | undefined = codeLens.data.tsUri;
		const tsOffset: number | undefined = codeLens.data.tsOffset;
		const sourceFile = uri ? sourceFiles.get(uri) : undefined;
		const tsDoc = tsUri ? sourceFile?.getTsDocuments()?.get(tsUri) : undefined;

		if (uri && tsDoc && sourceFile && tsOffset !== undefined) {
			const references0 = _findReferences(tsDoc, tsDoc.positionAt(tsOffset));
			const references = references0?.filter(ref => {
				for (const cssSourceMap of sourceFile.getCssSourceMaps()) {
					if (cssSourceMap.isSource(ref.range)) {
						return false;
					}
				}
				return true;
			});
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

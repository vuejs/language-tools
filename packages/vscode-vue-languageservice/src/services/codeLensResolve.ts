import {
	CodeLens,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import * as findReferences from './references';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import { Commands } from '../commands';
import { TsSourceMap } from '../utils/sourceMaps';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService, getGlobalTsSourceMaps: () => Map<string, { sourceMap: TsSourceMap }>) {
	const _findReferences = findReferences.register(sourceFiles, tsLanguageService, getGlobalTsSourceMaps);
	return (codeLens: CodeLens) => {

		const uri: string | undefined = codeLens.data.uri;
		const tsUri: string | undefined = codeLens.data.tsUri;
		const tsOffset: number | undefined = codeLens.data.tsOffset;
		const tsDoc = tsUri ? tsLanguageService.getTextDocument(tsUri) : undefined;
		const sourceFile = uri ? sourceFiles.get(uri) : undefined;

		if (uri && tsDoc && tsOffset !== undefined) {
			const references0 = _findReferences(tsDoc, tsDoc.positionAt(tsOffset));
			let references = references0;
			if (sourceFile) {
				references = references0?.filter(ref => {
					if (ref.uri === uri) {
						for (const cssSourceMap of sourceFile.getCssSourceMaps()) {
							if (cssSourceMap.isSource(ref.range)) {
								return false;
							}
						}
						for (const cssSourceMap of sourceFile.getHtmlSourceMaps()) {
							if (cssSourceMap.isSource(ref.range)) {
								return false;
							}
						}
						for (const cssSourceMap of sourceFile.getPugSourceMaps()) {
							if (cssSourceMap.isSource(ref.range)) {
								return false;
							}
						}
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

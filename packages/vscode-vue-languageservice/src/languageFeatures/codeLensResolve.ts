import {
	CodeLens,
	Position,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as findReferences from './references';
import type * as ts2 from '@volar/vscode-typescript-languageservice';
import { Commands } from '../commands';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	const _findReferences = findReferences.register(sourceFiles, tsLanguageService);
	return (codeLens: CodeLens) => {
		const uri: string | undefined = codeLens.data.uri;
		const tsDoc: TextDocument | undefined = codeLens.data.tsDoc;
		const tsPos: Position | undefined = codeLens.data.tsPos;
		const sourceFile = uri ? sourceFiles.get(uri) : undefined;
		if (uri && tsDoc && tsPos && sourceFile) {
			const references0 = _findReferences(tsDoc, tsPos);
			const references = references0?.filter(ref => {
				for (const cssSourceMap of sourceFile.getCssSourceMaps()) {
					if (cssSourceMap.isSource(ref.range)) {
						return false;
					}
				}
				return true;
			});
			const referencesCount = references?.length ?? 0;
			console.log(referencesCount);
			codeLens.command = {
				title: referencesCount === 1 ? '1 reference' : `${referencesCount} references`,
				command: referencesCount ? Commands.SHOW_REFERENCES : '',
				arguments: [uri, codeLens.range.start, references0],
			};
		}

		return codeLens;
	}
}

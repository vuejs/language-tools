import {
	TextDocument,
	Position,
} from 'vscode-languageserver/node';
import { SourceFile } from '../sourceFiles';
import * as globalServices from '../globalServices';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, position: Position)  => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult) return htmlResult;

		function getHtmlResult(sourceFile: SourceFile) {
			const vueHtmlDoc = sourceFile.getVueHtmlDocument();
			return globalServices.html.findLinkedEditingRanges(document, position, vueHtmlDoc);
		}
	}
}

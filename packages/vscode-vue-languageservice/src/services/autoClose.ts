import {
	Position,
	Range,
} from 'vscode-languageserver';
import type { SourceFile } from '../sourceFiles';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as getEmbeddedDocument from './embeddedDocument';
import * as globalServices from '../globalServices';

export function register(sourceFiles: Map<string, SourceFile>) {
	const getEmbeddedDoc = getEmbeddedDocument.register(sourceFiles);

	return (document: TextDocument, position: Position): string | undefined | null => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = Range.create(position, position);

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult) {
			return htmlResult;
		}

		const lang = getEmbeddedDoc(document, { start: position, end: position })?.document.languageId;
		if (lang === 'vue') {
			return globalServices.html.doTagComplete(document, position, sourceFile.getVueHtmlDocument());
		}

		function getHtmlResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				const virtualLocs = sourceMap.sourceToTargets(range);
				for (const virtualLoc of virtualLocs) {
					const result = globalServices.html.doTagComplete(sourceMap.targetDocument, virtualLoc.range.start, sourceMap.htmlDocument);
					if (result) return result;
				}
			}
		}
	}
}

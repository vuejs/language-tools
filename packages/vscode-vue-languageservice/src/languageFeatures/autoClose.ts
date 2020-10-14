import {
	Position,
	Range,
} from 'vscode-languageserver';
import type { SourceFile } from '../sourceFiles';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as getEmbeddedLanguage from './embeddedLanguage';
import * as globalServices from '../globalServices';

export function register(sourceFiles: Map<string, SourceFile>) {
	const getLang = getEmbeddedLanguage.register(sourceFiles);

	return (document: TextDocument, position: Position): string | undefined | null => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = Range.create(position, position);

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult) {
			return htmlResult;
		}

		const lang = getLang(document, { start: position, end: position });
		if (lang?.id === 'vue') {
			return globalServices.html.doTagComplete(document, position, sourceFile.getVueHtmlDocument());
		}

		function getHtmlResult(sourceFile: SourceFile) {
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				const virtualLocs = sourceMap.findVirtualLocations(range);
				for (const virtualLoc of virtualLocs) {
					const result = globalServices.html.doTagComplete(sourceMap.virtualDocument, virtualLoc.range.start, sourceMap.htmlDocument);
					if (result) return result;
				}
			}
		}
	}
}

import { SourceMapWithDocuments } from '@volar/language-service';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as html from 'vscode-html-languageservice';
import { baseParse } from './baseParse';
import { SourceMap } from '@volar/source-map';

export interface PugDocument extends ReturnType<ReturnType<typeof register>> { }

export function register(htmlLs: html.LanguageService) {

	return (pugCode: string) => {

		const parsed = baseParse(pugCode);
		const htmlTextDocument = TextDocument.create('foo.html', 'html', 0, parsed.htmlCode);
		const sourceMap = new SourceMapWithDocuments(
			parsed.pugTextDocument,
			htmlTextDocument,
			new SourceMap(parsed.mappings),
		);
		const htmlDocument = htmlLs.parseHTMLDocument(htmlTextDocument);

		return {
			pugTextDocument: parsed.pugTextDocument,
			htmlTextDocument,
			htmlDocument,
			map: sourceMap,
			error: parsed.error,
			ast: parsed.ast,
		};
	};
}

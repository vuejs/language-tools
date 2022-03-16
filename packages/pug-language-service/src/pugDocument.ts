import * as SourceMap from '@volar/source-map';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as html from 'vscode-html-languageservice';
import { baseParse } from './baseParse';

export interface PugDocument extends ReturnType<ReturnType<typeof register>> { }

export function register(htmlLs: html.LanguageService) {

	return (pugCode: string) => {

		const parsed = baseParse(pugCode);
		const htmlTextDocument = TextDocument.create('foo.html', 'html', 0, parsed.htmlCode);
		const sourceMap = new SourceMap.SourceMap(
			parsed.pugTextDocument,
			htmlTextDocument,
			parsed.sourceMap.mappings,
		);
		const htmlDocument = htmlLs.parseHTMLDocument(htmlTextDocument);

		return {
			pugTextDocument: parsed.pugTextDocument,
			htmlTextDocument,
			htmlDocument,
			sourceMap,
			error: parsed.error,
			ast: parsed.ast,
		};
	}
}

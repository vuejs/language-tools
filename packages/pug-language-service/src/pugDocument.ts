import { SourceMapBase, Mapping } from '@volar/source-map';
import { TextDocument } from 'vscode-languageserver-textdocument';
import type * as html from 'vscode-html-languageservice';
import { baseParse } from './baseParse';
import * as vscode from 'vscode-languageserver-types';

export interface PugDocument extends ReturnType<ReturnType<typeof register>> { }

export function register(htmlLs: html.LanguageService) {

	return (pugCode: string) => {

		const parsed = baseParse(pugCode);
		const htmlTextDocument = TextDocument.create('foo.html', 'html', 0, parsed.htmlCode);
		const sourceMap = new SourceMap(
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

// TODO: reuse from vueDocuments.ts
export class SourceMap<Data = undefined> extends SourceMapBase<Data> {

	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		public _mappings?: Mapping<Data>[],
	) {
		super(_mappings);
	}

	public getSourceRange<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
		for (const maped of this.getRanges(start, end ?? start, false, filter)) {
			return maped;
		}
	}
	public getMappedRange<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
		for (const maped of this.getRanges(start, end ?? start, true, filter)) {
			return maped;
		}
	}
	public getSourceRanges<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
		return this.getRanges(start, end ?? start, false, filter);
	}
	public getMappedRanges<T extends number | vscode.Position>(start: T, end?: T, filter?: (data: Data) => boolean) {
		return this.getRanges(start, end ?? start, true, filter);
	}

	protected * getRanges<T extends number | vscode.Position>(start: T, end: T, sourceToTarget: boolean, filter?: (data: Data) => boolean) {

		const startIsNumber = typeof start === 'number';
		const endIsNumber = typeof end === 'number';

		const toDoc = sourceToTarget ? this.mappedDocument : this.sourceDocument;
		const fromDoc = sourceToTarget ? this.sourceDocument : this.mappedDocument;
		const startOffset = startIsNumber ? start : fromDoc.offsetAt(start);
		const endOffset = endIsNumber ? end : fromDoc.offsetAt(end);

		for (const maped of super.getRanges(startOffset, endOffset, sourceToTarget, filter)) {
			yield getMaped(maped);
		}

		function getMaped(maped: [{ start: number, end: number }, Data]): [{ start: T, end: T }, Data] {
			if (startIsNumber) {
				return maped as [{ start: T, end: T }, Data];
			}
			return [{
				start: toDoc.positionAt(maped[0].start) as T,
				end: toDoc.positionAt(maped[0].end) as T,
			}, maped[1]];
		}
	}
}

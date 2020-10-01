import { Range } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as html from 'vscode-html-languageservice';
import * as css from 'vscode-css-languageservice';
import * as ts from '@volar/vscode-typescript-languageservice';

interface MapedRange {
	start: number,
	end: number,
}

export enum MapedMode {
	Offset = 'offset',
	Gate = 'gate',
}

export interface Mapping<T = undefined> {
	data: T,
	mode: MapedMode,
	originalRange: MapedRange,
	mappingRange: MapedRange,
}

export class SourceMap<MapedData = unknown> extends Set<Mapping<MapedData>> {
	constructor(
		public sourceDocument: TextDocument,
		public targetDocument: TextDocument,
	) {
		super();
	}
	public isSource(sourceRange: Range) {
		const sourceStartOffset = this.sourceDocument.offsetAt(sourceRange.start);
		const sourceEndOffset = this.sourceDocument.offsetAt(sourceRange.end);
		for (const maped of this) {
			if (maped.mode === MapedMode.Gate) {
				const sourceStartOffset_2 = maped.originalRange.start;
				const sourceEndOffset_2 = maped.originalRange.end;
				if (sourceStartOffset === sourceStartOffset_2 && sourceEndOffset === sourceEndOffset_2) {
					return true;
				}
			}
			else {
				const sourceStartOffset_2 = maped.originalRange.start;
				const sourceEndOffset_2 = maped.originalRange.end;
				if (sourceStartOffset >= sourceStartOffset_2 && sourceEndOffset <= sourceEndOffset_2) {
					return true;
				}
			}
		}
		return false;
	}
	public isTarget(targetRange: Range) {
		const targetStartOffset = this.targetDocument.offsetAt(targetRange.start);
		const targetEndOffset = this.targetDocument.offsetAt(targetRange.end);
		for (const maped of this) {
			if (maped.mode === MapedMode.Gate) {
				const targetStartOffset_2 = maped.mappingRange.start;
				const targetEndOffset_2 = maped.mappingRange.end;
				if (targetStartOffset === targetStartOffset_2 && targetEndOffset === targetEndOffset_2) {
					return true;
				}
			}
			else {
				const startOffset_2 = maped.mappingRange.start;
				const endOffset_2 = maped.mappingRange.end;
				if (targetStartOffset >= startOffset_2 && targetEndOffset <= endOffset_2) {
					return true;
				}
			}
		}
		return false;
	}
	public findSource(targetRange: Range): {
		range: Range,
		data: MapedData,
	} | undefined {
		const targetStartOffset = this.targetDocument.offsetAt(targetRange.start);
		const targetEndOffset = this.targetDocument.offsetAt(targetRange.end);
		for (const maped of this) {
			if (maped.mode === MapedMode.Gate) {
				const targetStartOffset_2 = maped.mappingRange.start;
				const targetEndOffset_2 = maped.mappingRange.end;
				if (targetStartOffset === targetStartOffset_2 && targetEndOffset === targetEndOffset_2) {
					return {
						data: maped.data,
						range: Range.create(
							this.sourceDocument.positionAt(maped.originalRange.start),
							this.sourceDocument.positionAt(maped.originalRange.end),
						),
					}
				}
			}
			else {
				const startOffset_2 = maped.mappingRange.start;
				const endOffset_2 = maped.mappingRange.end;
				if (targetStartOffset >= startOffset_2 && targetEndOffset <= endOffset_2) {
					const sourceStartOffset_2 = maped.originalRange.start;
					const sourceEndOffset_2 = maped.originalRange.end;
					const sourceStartOffset = sourceStartOffset_2 + targetStartOffset - startOffset_2;
					const sourceEndOffset = sourceEndOffset_2 + targetEndOffset - endOffset_2;
					return {
						data: maped.data,
						range: Range.create(
							this.sourceDocument.positionAt(sourceStartOffset),
							this.sourceDocument.positionAt(sourceEndOffset),
						),
					}
				}
			}
		}
	}
	public findTargets(sourceRange: Range) {
		const result: {
			range: Range,
			data: MapedData,
		}[] = [];
		const sourceStartOffset = this.sourceDocument.offsetAt(sourceRange.start);
		const sourceEndOffset = this.sourceDocument.offsetAt(sourceRange.end);
		for (const maped of this) {
			if (maped.mode === MapedMode.Gate) {
				const sourceStartOffset_2 = maped.originalRange.start;
				const sourceEndOffset_2 = maped.originalRange.end;
				if (sourceStartOffset === sourceStartOffset_2 && sourceEndOffset === sourceEndOffset_2) {
					result.push({
						range: Range.create(
							this.targetDocument.positionAt(maped.mappingRange.start),
							this.targetDocument.positionAt(maped.mappingRange.end),
						),
						data: maped.data,
					});
				}
			}
			else {
				const sourceStartOffset_2 = maped.originalRange.start;
				const sourceEndOffset_2 = maped.originalRange.end;
				if (sourceStartOffset >= sourceStartOffset_2 && sourceEndOffset <= sourceEndOffset_2) {
					const targetStartOffset_2 = maped.mappingRange.start;
					const targetEndOffset_2 = maped.mappingRange.end;
					const targetStartOffset = targetStartOffset_2 + sourceStartOffset - sourceStartOffset_2;
					const targetEndOffset = targetEndOffset_2 + sourceEndOffset - sourceEndOffset_2;
					result.push({
						data: maped.data,
						range: Range.create(
							this.targetDocument.positionAt(targetStartOffset),
							this.targetDocument.positionAt(targetEndOffset),
						),
					});
				}
			}
		}
		return result;
	}
}

export interface TsMappingData {
	vueTag: string,
	capabilities: {
		basic: boolean,
		references: boolean, // references, definitions, rename
		diagnostic: boolean,
		formatting: boolean,
	},
}

export class TsSourceMap extends SourceMap<TsMappingData> {
	constructor(
		public sourceDocument: TextDocument,
		public targetDocument: TextDocument,
		public languageService: ts.LanguageService,
	) {
		super(sourceDocument, targetDocument);
	}
}
export class CssSourceMap extends SourceMap<undefined> {
	constructor(
		public sourceDocument: TextDocument,
		public targetDocument: TextDocument,
		public languageService: css.LanguageService,
		public stylesheet: css.Stylesheet,
		public module: boolean,
		public links: [TextDocument, css.Stylesheet][],
	) {
		super(sourceDocument, targetDocument);
	}
}
export class HtmlSourceMap extends SourceMap<undefined> {
	constructor(
		public sourceDocument: TextDocument,
		public targetDocument: TextDocument,
		public languageService: html.LanguageService,
		public htmlDocument: html.HTMLDocument,
	) {
		super(sourceDocument, targetDocument);
	}
}

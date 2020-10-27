import { Range } from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as html from 'vscode-html-languageservice';
import * as css from 'vscode-css-languageservice';

export interface MapedRange {
	start: number,
	end: number,
}

export enum MapedMode {
	Offset,
	Gate,
}

export interface Mapping<T = undefined> {
	data: T,
	mode: MapedMode,
	vueRange: MapedRange,
	virtualRange: MapedRange,
}

export class SourceMap<MapedData = unknown> extends Set<Mapping<MapedData>> {
	constructor(
		public vueDocument: TextDocument,
		public virtualDocument: TextDocument,
	) {
		super();
	}
	public isVueLocation(vueRange: Range) {
		return this.maps(vueRange, true, true).length > 0;
	}
	public isVirtualLocation(virtualRange: Range) {
		return this.maps(virtualRange, false, true).length > 0;
	}
	public findFirstVueLocation(virtualRange: Range) {
		const result = this.maps(virtualRange, false, true);
		if (result.length) return result[0];
	}
	public findFirstVirtualLocation(vueRange: Range) {
		const result = this.maps(vueRange, true, true);
		if (result.length) return result[0];
	}
	public findVueLocations(virtualRange: Range) {
		return this.maps(virtualRange, false);
	}
	public findVirtualLocations(vueRange: Range) {
		return this.maps(vueRange, true);
	}
	private maps(range: Range, vueToVirtual: boolean, returnFirstResult?: boolean) {
		const result: {
			maped: Mapping<MapedData>,
			range: Range,
		}[] = [];
		const toDoc = vueToVirtual ? this.virtualDocument : this.vueDocument;
		const fromDoc = vueToVirtual ? this.vueDocument : this.virtualDocument;
		const fromRange = {
			start: fromDoc.offsetAt(range.start),
			end: fromDoc.offsetAt(range.end),
		};
		for (const maped of this) {
			const mapedToRange = vueToVirtual ? maped.virtualRange : maped.vueRange;
			const mapedFromRange = vueToVirtual ? maped.vueRange : maped.virtualRange;
			if (maped.mode === MapedMode.Gate) {
				if (fromRange.start === mapedFromRange.start && fromRange.end === mapedFromRange.end) {
					const toRange = Range.create(
						toDoc.positionAt(mapedToRange.start),
						toDoc.positionAt(mapedToRange.end),
					);
					result.push({
						maped,
						range: toRange,
					});
					if (returnFirstResult) return result;
				}
			}
			else if (maped.mode === MapedMode.Offset) {
				if (fromRange.start >= mapedFromRange.start && fromRange.end <= mapedFromRange.end) {
					const toRange = Range.create(
						toDoc.positionAt(mapedToRange.start + fromRange.start - mapedFromRange.start),
						toDoc.positionAt(mapedToRange.end + fromRange.end - mapedFromRange.end),
					);
					result.push({
						maped,
						range: toRange,
					});
					if (returnFirstResult) return result;
				}
			}
		}
		return result;
	}
}

export enum MapedNodeTypes {
	ElementTag,
	Prop,
}

export interface TsMappingData {
	vueTag: string,
	type?: MapedNodeTypes,
	capabilities: {
		basic: boolean,
		references: boolean, // references, definitions
		diagnostic: boolean,
		formatting: boolean,
		rename: boolean,
		completion: boolean,
		semanticTokens: boolean,
	},
}

export class TsSourceMap extends SourceMap<TsMappingData> {
	constructor(
		public vueDocument: TextDocument,
		public virtualDocument: TextDocument,
		public isInterpolation: boolean,
		public capabilities: {
			foldingRanges: boolean,
		},
	) {
		super(vueDocument, virtualDocument);
	}
}

export class CssSourceMap extends SourceMap<undefined> {
	constructor(
		public vueDocument: TextDocument,
		public virtualDocument: TextDocument,
		public stylesheet: css.Stylesheet,
		public module: boolean,
		public links: [TextDocument, css.Stylesheet][],
	) {
		super(vueDocument, virtualDocument);
	}
}

export class HtmlSourceMap extends SourceMap<undefined> {
	constructor(
		public vueDocument: TextDocument,
		public virtualDocument: TextDocument,
		public htmlDocument: html.HTMLDocument,
	) {
		super(vueDocument, virtualDocument);
	}
}

export class PugSourceMap extends SourceMap<undefined> {
	constructor(
		public vueDocument: TextDocument,
		public virtualDocument: TextDocument,
		public html: string | undefined,
		public mapper: ((code: string, htmlOffset: number) => number | undefined) | undefined,
	) {
		super(vueDocument, virtualDocument);
	}
}

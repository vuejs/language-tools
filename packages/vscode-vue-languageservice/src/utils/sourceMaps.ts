import type * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { HTMLDocument } from 'vscode-html-languageservice';
import type { Stylesheet } from 'vscode-css-languageservice';
import type { PugDocument } from 'vscode-pug-languageservice';
import type { JSONDocument } from 'vscode-json-languageservice';
import * as SourceMaps from '@volar/source-map';
import { TsMappingData, TeleportMappingData, TeleportSideData } from '@volar/vue-code-gen/out/types';

export class TsSourceMap extends SourceMaps.SourceMap<TsMappingData> {
	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		public lsType: 'template' | 'script',
		public isInterpolation: boolean,
		public capabilities: {
			foldingRanges: boolean,
			formatting: boolean,
			documentSymbol: boolean,
			codeActions: boolean,
		},
		mappings?: SourceMaps.Mapping<TsMappingData>[],
	) {
		super(sourceDocument, mappedDocument, mappings);
	}
}

export class CssSourceMap extends SourceMaps.SourceMap<undefined> {
	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		public stylesheet: Stylesheet | undefined,
		public module: string | undefined,
		public scoped: boolean,
		public links: { textDocument: TextDocument, stylesheet: Stylesheet }[],
		public capabilities: {
			foldingRanges: boolean,
			formatting: boolean,
		},
		mappings?: SourceMaps.Mapping<undefined>[],
	) {
		super(sourceDocument, mappedDocument, mappings);
	}
}

export class JsonSourceMap extends SourceMaps.SourceMap<undefined> {
	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		public jsonDocument: JSONDocument,
		mappings?: SourceMaps.Mapping<undefined>[],
	) {
		super(sourceDocument, mappedDocument, mappings);
	}
}

export class HtmlSourceMap extends SourceMaps.SourceMap<undefined> {
	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		public htmlDocument: HTMLDocument,
		public language: 'html' = 'html',
		mappings?: SourceMaps.Mapping<undefined>[],
	) {
		super(sourceDocument, mappedDocument, mappings);
	}
}

export class PugSourceMap extends SourceMaps.SourceMap<undefined> {
	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		public pugDocument: PugDocument,
		public language: 'pug' = 'pug',
	) {
		super(sourceDocument, mappedDocument);
	}
}

export class TeleportSourceMap extends SourceMaps.SourceMap<TeleportMappingData> {
	constructor(
		public document: TextDocument,
		public allowCrossFile: boolean,
	) {
		super(document, document);
	}
	*findTeleports(start: vscode.Position, end?: vscode.Position, filter?: (data: TeleportSideData) => boolean) {
		for (const [teleRange, data] of this.getMappedRanges(start, end, filter ? data => filter(data.toTarget) : undefined)) {
			yield [teleRange, data.toTarget] as const;
		}
		for (const [teleRange, data] of this.getSourceRanges(start, end, filter ? data => filter(data.toSource) : undefined)) {
			yield [teleRange, data.toSource] as const;
		}
	}
	*findTeleports2(start: number, end?: number, filter?: (data: TeleportSideData) => boolean) {
		for (const [teleRange, data] of this.getMappedRanges(start, end, filter ? data => filter(data.toTarget) : undefined)) {
			yield [teleRange, data.toTarget] as const;
		}
		for (const [teleRange, data] of this.getSourceRanges(start, end, filter ? data => filter(data.toTarget) : undefined)) {
			yield [teleRange, data.toTarget] as const;
		}
	}
}

export * from '@volar/source-map';
export * from '@volar/vue-code-gen/out/types';

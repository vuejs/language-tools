import type * as vscode from 'vscode-languageserver';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { HTMLDocument } from 'vscode-html-languageservice';
import type { Stylesheet } from 'vscode-css-languageservice';
import type { PugDocument } from 'vscode-pug-languageservice';
import type { JSONDocument } from 'vscode-json-languageservice';
import * as SourceMaps from '@volar/source-map';

export interface TsMappingData {
	vueTag: 'sfc' | 'template' | 'script' | 'scriptSetup' | 'style' | 'scriptSrc',
	beforeRename?: (newName: string) => string,
	doRename?: (oldName: string, newName: string) => string,
	capabilities: {
		basic?: boolean,
		extraHoverInfo?: boolean,
		references?: boolean,
		definitions?: boolean,
		diagnostic?: boolean,
		formatting?: boolean,
		rename?: boolean | {
			in: boolean,
			out: boolean,
		},
		completion?: boolean,
		semanticTokens?: boolean,
		foldingRanges?: boolean,
		referencesCodeLens?: boolean,
		displayWithLink?: boolean,
	},
}

export interface TeleportSideData {
	editRenameText?: (newName: string) => string,
	capabilities: {
		references?: boolean,
		definitions?: boolean,
		rename?: boolean,
	},
}

export interface TeleportMappingData {
	isAdditionalReference?: boolean;
	toSource: TeleportSideData,
	toTarget: TeleportSideData,
}

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
	findTeleports(start: vscode.Position, end?: vscode.Position) {
		const result: {
			data: TeleportMappingData;
			sideData: TeleportSideData;
			start: vscode.Position,
			end: vscode.Position,
		}[] = [];
		for (const teleRange of this.getMappedRanges(start, end)) {
			result.push({
				...teleRange,
				sideData: teleRange.data.toTarget,
			});
		}
		for (const teleRange of this.getSourceRanges(start, end)) {
			result.push({
				...teleRange,
				sideData: teleRange.data.toSource,
			});
		}
		return result;
	}
	findTeleports2(start: number, end?: number) {
		const result: {
			data: TeleportMappingData;
			sideData: TeleportSideData;
			start: number,
			end: number,
		}[] = [];
		for (const teleRange of this.getMappedRanges2(start, end)) {
			result.push({
				...teleRange,
				sideData: teleRange.data.toTarget,
			});
		}
		for (const teleRange of this.getSourceRanges2(start, end)) {
			result.push({
				...teleRange,
				sideData: teleRange.data.toSource,
			});
		}
		return result;
	}
}

export * from '@volar/source-map';

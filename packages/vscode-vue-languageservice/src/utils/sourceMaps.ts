import type { Range } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { HTMLDocument } from 'vscode-html-languageservice';
import type { Stylesheet } from 'vscode-css-languageservice';
import type { PugDocument } from '@volar/vscode-pug-languageservice';
import { MapedRange, SourceMap } from '@volar/source-map';

export interface TsMappingData {
	vueTag: 'template' | 'script' | 'scriptSetup' | 'style' | 'scriptSrc',
	beforeRename?: (newName: string) => string,
	doRename?: (oldName: string, newName: string) => string,
	capabilities: {
		basic?: boolean,
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

export class TsSourceMap extends SourceMap<TsMappingData> {
	constructor(
		public sourceDocument: TextDocument,
		public targetDocument: TextDocument,
		public isInterpolation: boolean,
		public capabilities: {
			foldingRanges: boolean,
			formatting: boolean,
			documentSymbol: boolean,
		},
	) {
		super(sourceDocument, targetDocument);
	}
}

export class CssSourceMap extends SourceMap<undefined> {
	constructor(
		public sourceDocument: TextDocument,
		public targetDocument: TextDocument,
		public stylesheet: Stylesheet,
		public module: boolean,
		public scoped: boolean,
		public links: { textDocument: TextDocument, stylesheet: Stylesheet }[],
		public capabilities: {
			foldingRanges: boolean,
			formatting: boolean,
		},
	) {
		super(sourceDocument, targetDocument);
	}
}

export class HtmlSourceMap extends SourceMap<undefined> {
	constructor(
		public sourceDocument: TextDocument,
		public targetDocument: TextDocument,
		public htmlDocument: HTMLDocument,
		public language: 'html' = 'html',
	) {
		super(sourceDocument, targetDocument);
	}
}

export class PugSourceMap extends SourceMap<undefined> {
	constructor(
		public sourceDocument: TextDocument,
		public targetDocument: TextDocument,
		public pugDocument: PugDocument,
		public language: 'pug' = 'pug',
	) {
		super(sourceDocument, targetDocument);
	}
}

export class TeleportSourceMap extends SourceMap<TeleportMappingData> {
	constructor(
		public document: TextDocument,
	) {
		super(document, document);
	}
	findTeleports(range: Range) {
		const result: {
			data: TeleportMappingData;
			sideData: TeleportSideData;
			range: Range;
		}[] = [];
		for (const loc of this.sourceToTargets(range)) {
			result.push({
				...loc,
				sideData: loc.data.toTarget,
			});
		}
		for (const loc of this.targetToSources(range)) {
			result.push({
				...loc,
				sideData: loc.data.toSource,
			});
		}
		return result;
	}
	findTeleports2(range: MapedRange) {
		const result: {
			data: TeleportMappingData;
			sideData: TeleportSideData;
			range: MapedRange;
		}[] = [];
		for (const loc of this.sourceToTargets2(range)) {
			result.push({
				...loc,
				sideData: loc.data.toTarget,
			});
		}
		for (const loc of this.targetToSources2(range)) {
			result.push({
				...loc,
				sideData: loc.data.toSource,
			});
		}
		return result;
	}
}

export { SourceMap, MapedRange, MapedMode, Mapping } from '@volar/source-map';

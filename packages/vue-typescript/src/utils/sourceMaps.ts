import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as SourceMaps from '@volar/source-map';
import { EmbeddedDocumentMappingData, TeleportMappingData, TeleportSideData } from '@volar/vue-code-gen/out/types';

export class EmbeddedDocumentSourceMap extends SourceMaps.SourceMap<EmbeddedDocumentMappingData> {
	constructor(
		public sourceDocument: TextDocument,
		public mappedDocument: TextDocument,
		public lsType: 'template' | 'script' | undefined,
		public capabilities: {
			foldingRanges: boolean,
			formatting: boolean,
			documentSymbol: boolean,
			codeActions: boolean,
		},
		mappings?: SourceMaps.Mapping<EmbeddedDocumentMappingData>[],
	) {
		super(sourceDocument, mappedDocument, mappings);
	}
}

export class TeleportSourceMap extends SourceMaps.SourceMap<TeleportMappingData> {
	constructor(
		public document: TextDocument,
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

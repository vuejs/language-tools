import { SpanMapFeature, SpanMapKind } from '@volar/language-core';
import type { VueCodeMarker } from '../types';

/** Feature bits that only Volar's own services read; the content mapper strips them. */
export enum VueCodeFeature {
	PropsCompletion = 1 << 21,
}

export const completionFeatures = SpanMapFeature.Completion
	| SpanMapFeature.AutoInsert;

export const semanticFeatures = SpanMapFeature.Hover
	| SpanMapFeature.SignatureHelp
	| SpanMapFeature.InlayHints
	| SpanMapFeature.SemanticTokens;

export const navigationFeatures = SpanMapFeature.Definition
	| SpanMapFeature.TypeDefinition
	| SpanMapFeature.Implementation
	| SpanMapFeature.References
	| SpanMapFeature.DocumentHighlights
	| SpanMapFeature.Rename
	| SpanMapFeature.CallHierarchy
	| SpanMapFeature.CodeActions
	| SpanMapFeature.LinkedEditing;

/** The features of generated script code; the structure and formatting ones belong to whole embedded documents. */
export const scriptFeatures = completionFeatures
	| semanticFeatures
	| navigationFeatures;

export const structureFeatures = SpanMapFeature.FoldingRanges
	| SpanMapFeature.SelectionRanges
	| SpanMapFeature.DocumentSymbols
	| SpanMapFeature.CodeLens;

/** Every protocol feature; the other bits of a mapping are Vue's own. */
export const allFeatures = scriptFeatures
	| structureFeatures
	| SpanMapFeature.Formatting;

export function ignoreDiagnostics(info: VueCodeMarker): VueCodeMarker {
	return { ...info, ignoreDiagnostics: true };
}

export function toAtomKind(info: VueCodeMarker): VueCodeMarker {
	return { ...info, kind: SpanMapKind.Atom };
}

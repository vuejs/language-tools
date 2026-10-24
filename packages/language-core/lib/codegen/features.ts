import { SpanMapFeature } from '@volar/language-core';

/** Feature bits that only Volar's own services read; the content mapper strips them. */
export enum VueCodeFeature {
	PropsCompletion = 1 << 21,
}

export const completionFeatures = SpanMapFeature.Completion
	| SpanMapFeature.AutoInsert;

/** The type information features, without semantic tokens. */
export const semanticFeatures = SpanMapFeature.Hover
	| SpanMapFeature.SignatureHelp
	| SpanMapFeature.InlayHints;

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
	| SpanMapFeature.SemanticTokens
	| navigationFeatures;

export const structureFeatures = SpanMapFeature.FoldingRanges
	| SpanMapFeature.SelectionRanges
	| SpanMapFeature.DocumentSymbols
	| SpanMapFeature.CodeLens;

/** Every protocol feature; the other bits of a mapping are Vue's own. */
export const allFeatures = scriptFeatures
	| structureFeatures
	| SpanMapFeature.Formatting;

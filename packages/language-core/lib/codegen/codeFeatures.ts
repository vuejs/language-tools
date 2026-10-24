import { SpanMapFeature, SpanMapKind } from '@volar/language-core';
import type { VueCodeInformation, VueCodeMarker } from '../types';

export enum VueCodeFeature {
	PropsCompletion = 1 << 21,
}

const semantic = SpanMapFeature.Hover
	| SpanMapFeature.SignatureHelp
	| SpanMapFeature.InlayHints
	| SpanMapFeature.SemanticTokens;
const semanticWithoutHighlight = semantic & ~SpanMapFeature.SemanticTokens;
const completion = SpanMapFeature.Completion
	| SpanMapFeature.AutoInsert;
const navigation = SpanMapFeature.Definition
	| SpanMapFeature.TypeDefinition
	| SpanMapFeature.Implementation
	| SpanMapFeature.References
	| SpanMapFeature.DocumentHighlights
	| SpanMapFeature.Rename
	| SpanMapFeature.CallHierarchy
	| SpanMapFeature.CodeActions
	| SpanMapFeature.LinkedEditing;
const navigationWithoutRename = navigation & ~SpanMapFeature.Rename;
const structure = SpanMapFeature.FoldingRanges
	| SpanMapFeature.SelectionRanges
	| SpanMapFeature.DocumentSymbols
	| SpanMapFeature.CodeLens;
const format = SpanMapFeature.Formatting;
const verification = SpanMapFeature.Verification;

export const codeFeatures = {
	full: verification | completion | semantic | navigation | structure | format,
	/** @internal */
	all: verification | completion | semantic | navigation,
	/** @internal */
	verification,
	/** @internal */
	completion,
	/** @internal */
	withoutCompletion: verification | semantic | navigation,
	/** @internal */
	navigation,
	/** @internal */
	navigationWithoutRename,
	/** @internal */
	navigationAndCompletion: navigation | completion,
	/** @internal */
	navigationAndVerification: navigation | verification,
	/** @internal */
	withoutNavigation: verification | completion | semantic,
	/** @internal */
	semanticWithoutHighlight,
	/** @internal */
	withoutHighlight: semanticWithoutHighlight | verification | navigation | completion,
	/** @internal */
	withoutHighlightAndCompletion: semanticWithoutHighlight | verification | navigation,
	/** @internal */
	tagName: semanticWithoutHighlight | verification | navigation,
	/** @internal */
	withoutSemantic: verification | navigation | completion,
	/** @internal */
	structure,
	/** @internal */
	structureAndFormat: structure | format,
	/** @internal */
	format,
} satisfies Record<string, number>;

/** @deprecated use `codeFeatures.full` instead */
export const allCodeFeatures = codeFeatures.full;

export function getCodeFeatures(info: VueCodeInformation) {
	return typeof info === 'number' ? info : info.features;
}

export function withCodeFeatures(info: VueCodeInformation, features: number): VueCodeInformation {
	return typeof info === 'number' ? features : { ...info, features };
}

export function toAtomGroup(info: VueCodeInformation): VueCodeMarker {
	return typeof info === 'number' ? { features: info, atom: Symbol() } : { ...info, atom: Symbol() };
}

export function toAtomKind(info: VueCodeInformation): VueCodeMarker {
	return { ...typeof info === 'number' ? { features: info } : info, kind: SpanMapKind.Atom };
}

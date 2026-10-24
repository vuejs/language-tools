import { SpanMapFeature, SpanMapKind } from '@volar/language-core';
import type { VueCodeMarker } from '../types';

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

/** Shared, frozen markers; derive new markers from them instead of mutating them. */
export const codeFeatures = {
	full: marker(completion | semantic | navigation | structure | format),
	/** @internal */
	all: marker(completion | semantic | navigation),
	/** @internal */
	none: marker(0),
	/** @internal */
	completion: marker(completion),
	/** @internal */
	withoutCompletion: marker(semantic | navigation),
	/** @internal */
	navigation: marker(navigation),
	/** @internal */
	navigationWithoutRename: marker(navigationWithoutRename),
	/** @internal */
	navigationAndCompletion: marker(navigation | completion),
	/** @internal */
	withoutNavigation: marker(completion | semantic),
	/** @internal */
	semanticWithoutHighlight: marker(semanticWithoutHighlight),
	/** @internal */
	withoutHighlight: marker(semanticWithoutHighlight | navigation | completion),
	/** @internal */
	withoutHighlightAndCompletion: marker(semanticWithoutHighlight | navigation),
	/** @internal */
	tagName: marker(semanticWithoutHighlight | navigation),
	/** @internal */
	withoutSemantic: marker(navigation | completion),
	/** @internal */
	structure: marker(structure),
	/** @internal */
	structureAndFormat: marker(structure | format),
	/** @internal */
	format: marker(format),
	/** @internal */
	propsCompletion: marker(VueCodeFeature.PropsCompletion),
	/** @internal */
	propName: marker(semanticWithoutHighlight | navigation | VueCodeFeature.PropsCompletion),
	/** @internal */
	eventName: marker(semanticWithoutHighlight | navigationWithoutRename),
} satisfies Record<string, VueCodeMarker>;

function marker(features: number): VueCodeMarker {
	return Object.freeze({ features });
}

export function ignoreDiagnostics(info: VueCodeMarker): VueCodeMarker {
	return { ...info, ignoreDiagnostics: true };
}

export function toAtomKind(info: VueCodeMarker): VueCodeMarker {
	return { ...info, kind: SpanMapKind.Atom };
}

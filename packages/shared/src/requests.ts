/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	RequestType,
	RequestType0,
	TextDocumentPositionParams,
	TextDocumentIdentifier,
	Range,
} from 'vscode-languageserver';

export namespace TagCloseRequest {
	export const type: RequestType<TextDocumentPositionParams, string | null | undefined, any, any> = new RequestType('html/tag');
}
export namespace GetEmbeddedLanguageRequest {
	export const type: RequestType<{
		textDocument: TextDocumentIdentifier,
		range: Range,
	}, {
		id: string,
		range: Range,
	} | undefined, any, any> = new RequestType('vue/embeddedLanguage');
}
export namespace VerifyAllScriptsRequest {
	export const type: RequestType<undefined, undefined, any, any> = new RequestType('volar.action.verifyAllScripts');
}
export namespace FormatAllScriptsRequest {
	export const type: RequestType<undefined, undefined, any, any> = new RequestType('volar.action.formatAllScripts');
}

// semantic tokens
export interface SemanticTokenParams {
	textDocument: TextDocumentIdentifier;
	range: Range;
}
export namespace SemanticTokensRequest {
	export const type: RequestType<SemanticTokenParams, [number, number, number, number, number | undefined | null][], any, any> = new RequestType('vue/semanticTokens');
}
export namespace SemanticTokenLegendRequest {
	export const type: RequestType0<{ types: string[]; modifiers: string[] }, any, any> = new RequestType0('vue/semanticTokenLegend');
}

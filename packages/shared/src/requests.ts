/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	RequestType,
	RequestType0,
	NotificationType0,
	TextDocumentPositionParams,
	TextDocumentIdentifier,
	Range,
	FormattingOptions,
} from 'vscode-languageserver';

export interface ISourceMap {
	languageId: string;
	content: string;
	vueRegion: string;
	mappings: {
		sourceRange: {
			start: number;
			end: number;
		};
		targetRange: {
			start: number;
			end: number;
		};
	}[],
}

export namespace TagCloseRequest {
	export const type: RequestType<TextDocumentPositionParams, string | null | undefined, any, any> = new RequestType('html/tag');
}
export namespace GetFormattingSourceMapsRequest {
	export const type: RequestType<{
		textDocument: TextDocumentIdentifier,
	}, {
		templates: ISourceMap[],
		scripts: ISourceMap[],
		styles: ISourceMap[],
	} | undefined, any, any> = new RequestType('vue.descriptor');
}
export namespace VerifyAllScriptsRequest {
	export const type: RequestType<undefined, undefined, any, any> = new RequestType('volar.action.verifyAllScripts');
}
export namespace FormatAllScriptsRequest {
	export const type: RequestType<FormattingOptions, undefined, any, any> = new RequestType('volar.action.formatAllScripts');
}
export namespace WriteAllDebugFilesRequest {
	export const type: RequestType<undefined, undefined, any, any> = new RequestType('volar.action.writeAllDebugFiles');
}
export namespace EmmetConfigurationRequest {
	export const type: RequestType<string, any, any, any> = new RequestType('volar.getEmmetConfiguration');
}

// semantic tokens
export interface SemanticTokenParams {
	textDocument: TextDocumentIdentifier;
	range: Range;
}
export namespace SemanticTokensRequest {
	export const type: RequestType<SemanticTokenParams, [number, number, number, number, number | undefined | null][], any, any> = new RequestType('vue.semanticTokens');
}
export namespace SemanticTokenLegendRequest {
	export const type: RequestType0<{ types: string[]; modifiers: string[] }, any, any> = new RequestType0('vue.semanticTokenLegend');
}
export namespace SemanticTokensChangedNotification {
	export const type: NotificationType0 = new NotificationType0('vue.semanticTokensChanged');
}

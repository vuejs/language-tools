/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	RequestType,
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
	} | undefined, any, any> = new RequestType('comment');
}
export namespace VerifyAllScriptsRequest {
	export const type: RequestType<undefined, undefined, any, any> = new RequestType('comment');
}

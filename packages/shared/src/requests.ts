/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	RequestType,
	TextDocumentPositionParams,
} from 'vscode-languageserver';

export namespace TagCloseRequest {
	export const type: RequestType<TextDocumentPositionParams, string | null | undefined, any, any> = new RequestType('html/tag');
}

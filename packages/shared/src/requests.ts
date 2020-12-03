/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	RequestType,
	NotificationType,
	TextDocumentPositionParams,
	TextDocumentIdentifier,
	FormattingOptions,
	Position,
	Location,
	DocumentUri,
} from 'vscode-languageserver/node';

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
	export const type: RequestType<TextDocumentPositionParams, string | null | undefined, any> = new RequestType('html/tag');
}
export namespace GetFormattingSourceMapsRequest {
	export const type: RequestType<{
		textDocument: TextDocumentIdentifier,
	}, {
		templates: ISourceMap[],
		scripts: ISourceMap[],
		styles: ISourceMap[],
	} | undefined, any> = new RequestType('vue.descriptor');
}
export namespace VerifyAllScriptsRequest {
	export const type: RequestType<undefined, undefined, any> = new RequestType('volar.action.verifyAllScripts');
}
export namespace FormatAllScriptsRequest {
	export const type: RequestType<FormattingOptions, undefined, any> = new RequestType('volar.action.formatAllScripts');
}
export namespace WriteAllDebugFilesRequest {
	export const type: RequestType<undefined, undefined, any> = new RequestType('volar.action.writeAllDebugFiles');
}
export namespace EmmetConfigurationRequest {
	export const type: RequestType<string, any, any> = new RequestType('volar.getEmmetConfiguration');
}

export namespace ShowReferencesNotification {
	export const type: NotificationType<{ uri: DocumentUri, position: Position, references: Location[] }> = new NotificationType('vue.findReferences');
}

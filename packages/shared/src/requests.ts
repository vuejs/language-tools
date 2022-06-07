import * as vscode from 'vscode-languageserver-protocol';

/**
 * Client Requests
 */

export namespace GetDocumentContentRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = string;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vscode/content');
}

export namespace GetDocumentVersionRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = number | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/docVersion');
}

export namespace ShowReferencesNotification {
	export type ResponseType = vscode.TextDocumentPositionParams & { references: vscode.Location[]; };
	export const type = new vscode.NotificationType<ResponseType>('vue.findReferences');
}

export namespace GetDocumentNameCasesRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = {
		tagNameCase: 'both' | 'kebabCase' | 'pascalCase',
		attrNameCase: 'kebabCase' | 'camelCase',
	};
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/getAttrNameCaseClient');
}

export namespace GetDocumentPrintWidthRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = number | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/getDocumentWordWrapColumn');
}

export namespace GetEditorSelectionRequest {
	export type ResponseType = vscode.TextDocumentPositionParams | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType0<ResponseType, ErrorType>('vue/activeSelection');
}

export namespace FindFileReferenceRequest {
	export type ParamsType = {
		textDocument: vscode.TextDocumentIdentifier;
	};
	export type ResponseType = vscode.Location[] | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/findFileReference');
}

/**
 * Server Requests
 */

export namespace InitDoneRequest {
	export type ResponseType = null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType0<ResponseType, ErrorType>('volar/init');
}

export namespace GetMatchTsConfigRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = string | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/tsconfig');
}

export namespace D3Request {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = string | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/d3');
}

export namespace AutoInsertRequest {
	export type ParamsType = vscode.TextDocumentPositionParams & {
		options: {
			lastChange: {
				range: vscode.Range;
				rangeOffset: number;
				rangeLength: number;
				text: string;
			},
		},
	};
	export type ResponseType = string | vscode.TextEdit | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/autoInsert');
}

export namespace VerifyAllScriptsNotification {
	export const type = new vscode.NotificationType0('volar.action.verifyAllScripts');
}

export namespace WriteVirtualFilesNotification {
	export const type = new vscode.NotificationType0('volar.action.writeVirtualFiles');
}

export namespace DetectDocumentNameCasesRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = {
		tag: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
		attr: 'both' | 'kebabCase' | 'camelCase' | 'unsure',
	} | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/getTagNameCaseServer');
}

import * as rpc from 'vscode-jsonrpc';
import type * as vscode from 'vscode-languageserver';

/**
 * Client Requests
 */

export namespace GetDocumentContentRequest {
	export type ParamsType = string;
	export type ResponseType = string;
	export type ErrorType = never;
	export const type = new rpc.RequestType<ParamsType, ResponseType, ErrorType>('vscode/content');
}


export namespace GetDocumentVersionRequest {
	export type ParamsType = { uri: string };
	export type ResponseType = number | undefined;
	export type ErrorType = never;
	export const type = new rpc.RequestType<ParamsType, ResponseType, ErrorType>('vue/docUpdated');
}

export namespace ShowReferencesNotification {
	export type ParamsType = { uri: vscode.DocumentUri, position: vscode.Position, references: vscode.Location[] };
	export const type = new rpc.NotificationType<ParamsType>('vue.findReferences');
}

export namespace GetDocumentNameCasesRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = {
		tagNameCase: 'both' | 'kebabCase' | 'pascalCase',
		attrNameCase: 'kebabCase' | 'pascalCase',
	};
	export type ErrorType = never;
	export const type = new rpc.RequestType<ParamsType, ResponseType, ErrorType>('volar/getAttrNameCaseClient');
}

export namespace GetDocumentSelectionRequest {
	export type ResponseType = {
		uri: string,
		offset: number,
	} | undefined;
	export type ErrorType = never;
	export const type = new rpc.RequestType0<ResponseType, ErrorType>('vue/activeSelection');
}

/**
 * Server Requests
 */

export namespace PingRequest {
	export type ResponseType = 'pong' | null | undefined;
	export type ErrorType = never;
	export const type = new rpc.RequestType0<ResponseType, ErrorType>('volar/ping');
}

export namespace D3Request {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = string | null | undefined;
	export type ErrorType = never;
	export const type = new rpc.RequestType<ParamsType, ResponseType, ErrorType>('volar/d3');
}

export namespace GetTagCloseEditsRequest {
	export type ParamsType = vscode.TextDocumentPositionParams;
	export type ResponseType = string | null | undefined;
	export type ErrorType = never;
	export const type = new rpc.RequestType<ParamsType, ResponseType, ErrorType>('html/tag');
}

export namespace GetRefCompleteEditsRequest {
	export type ParamsType = vscode.TextDocumentPositionParams;
	export type ResponseType = string | null | undefined;
	export type ErrorType = never;
	export const type = new rpc.RequestType<ParamsType, ResponseType, ErrorType>('volar/ref');
}

export namespace VerifyAllScriptsNotification {
	export const type = new rpc.NotificationType0('volar.action.verifyAllScripts');
}

export namespace WriteVirtualFilesNotification {
	export type ParamsType = { lsType: 'template' | 'script' };
	export const type = new rpc.NotificationType<ParamsType>('volar.action.writeVirtualFiles');
}

export namespace RestartServerNotification {
	export type ParamsType = {
		serverPath: string,
		localizedPath: string | undefined,
	} | undefined;
	export const type = new rpc.NotificationType<ParamsType>('volar.action.restartServer');
}

export namespace DetectDocumentNameCasesRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = {
		tag: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
		attr: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
	} | null | undefined;
	export type ErrorType = never;
	export const type = new rpc.RequestType<ParamsType, ResponseType, ErrorType>('volar/getTagNameCaseServer');
}

export namespace RemoveAllRefSugars {
	export const type = new rpc.NotificationType0('volar/removeAllRefSugars');
}

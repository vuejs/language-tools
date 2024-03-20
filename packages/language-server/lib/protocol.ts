import type { AttrNameCasing, SFCParseResult, TagNameCasing } from '@vue/language-service';
import * as vscode from 'vscode-languageserver-protocol';

export namespace DetectNameCasingRequest {
	export type ParamsType = {
		textDocument: vscode.TextDocumentIdentifier,
	};
	export type ResponseType = {
		tag: TagNameCasing[],
		attr: AttrNameCasing[],
	} | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/detectTagCasing');
}

export namespace GetConvertTagCasingEditsRequest {
	export type ParamsType = {
		textDocument: vscode.TextDocumentIdentifier,
		casing: TagNameCasing,
	};
	export type ResponseType = vscode.TextEdit[] | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/convertTagNameCasing');
}

export namespace GetConvertAttrCasingEditsRequest {
	export type ParamsType = {
		textDocument: vscode.TextDocumentIdentifier,
		casing: AttrNameCasing,
	};
	export type ResponseType = vscode.TextEdit[] | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/convertPropNameCasing');
}

export namespace ParseSFCRequest {
	export type ParamsType = string;
	export type ResponseType = SFCParseResult;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/parseSfc');
}

export namespace GetConnectedNamedPipeServerRequest {
	export type ParamsType = string;
	export type ResponseType = {
		path: string,
		serverKind: number,
	} | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/namedPipeServer');
}

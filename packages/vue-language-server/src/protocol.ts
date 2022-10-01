import * as vscode from 'vscode-languageserver-protocol';
import { TagNameCasing, AttrNameCasing } from '@volar/vue-language-service';

export namespace DetectNameCasingRequest {
	export type ParamsType = {
		textDocument: vscode.TextDocumentIdentifier,
	};
	export type ResponseType = {
		tag: TagNameCasing[],
		attr: AttrNameCasing[],
	} | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/detectTagCasing');
}

export namespace GetConvertTagCasingEditsRequest {
	export type ParamsType = {
		textDocument: vscode.TextDocumentIdentifier,
		casing: TagNameCasing,
	};
	export type ResponseType = vscode.TextEdit[] | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/convertTagNameCasing');
}

export namespace GetConvertAttrCasingEditsRequest {
	export type ParamsType = {
		textDocument: vscode.TextDocumentIdentifier,
		casing: AttrNameCasing,
	};
	export type ResponseType = vscode.TextEdit[] | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/convertAttrNameCasing');
}

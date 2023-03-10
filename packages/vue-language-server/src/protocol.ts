import * as vscode from 'vscode-languageserver-protocol';
import { TagNameCasing, AttrNameCasing, SFCParseResult, VueCompilerOptions } from '@volar/vue-language-service';
import { ComponentMeta } from 'vue-component-meta';

export namespace GetVueCompilerOptionsRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = VueCompilerOptions | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/vueCompilerOptions');
}

export namespace GetComponentMeta {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = ComponentMeta | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/meta');
}

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

export namespace ParseSFCRequest {
	export type ParamsType = string;
	export type ResponseType = SFCParseResult;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/parseSfc');
}

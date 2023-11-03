import * as vscode from 'vscode-languageserver-protocol';
import { TagNameCasing, AttrNameCasing, SFCParseResult } from '@vue/language-service';
import { ComponentMeta } from 'vue-component-meta';

export namespace GetComponentMeta {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = ComponentMeta | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/componentMeta');
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

export namespace GetDragAndDragImportEditsRequest {
	export type ParamsType = {
		uri: string,
		importUri: string,
		casing: TagNameCasing,
	};
	export type ResponseType = {
		insertText: string;
		insertTextFormat: vscode.InsertTextFormat;
		additionalEdits: vscode.TextEdit[];
	} | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/dragImportEdits');
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

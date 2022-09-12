import * as vscode from 'vscode-languageserver-protocol';

export namespace DetectTagCasingRequest {
	export type ParamsType = {
		textDocument: vscode.TextDocumentIdentifier,
	};
	export type ResponseType = {
		tag: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
		attr: 'both' | 'kebabCase' | 'camelCase' | 'unsure',
	} | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/detectTagCasing');
}

export namespace GetConvertTagCasingEditsRequest {
	export type ParamsType = {
		textDocument: vscode.TextDocumentIdentifier,
		casing: 'kebab' | 'pascal',
	};
	export type ResponseType = vscode.TextEdit[] | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/getTagCasing');
}

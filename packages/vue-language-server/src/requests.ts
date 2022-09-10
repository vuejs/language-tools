import * as vscode from 'vscode-languageserver-protocol';
import type * as html from 'vscode-html-languageservice';

/**
 * Server request client
 */

export namespace GetDocumentContentRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = string;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vscode/content');
}

export namespace ShowReferencesNotification {
	export type ResponseType = vscode.TextDocumentPositionParams & { references: vscode.Location[]; };
	export const type = new vscode.NotificationType<ResponseType>('vue.findReferences');
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
 * Client request server
 */

export namespace GetMatchTsConfigRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = string | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('volar/tsconfig');
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
	export const type = new vscode.NotificationType<vscode.TextDocumentIdentifier>('volar.action.verifyAllScripts');
}

export namespace WriteVirtualFilesNotification {
	export const type = new vscode.NotificationType<vscode.TextDocumentIdentifier>('volar.action.writeVirtualFiles');
}

export namespace ReloadProjectNotification {
	export const type = new vscode.NotificationType<vscode.TextDocumentIdentifier>('volar.action.reloadProject');
}

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

/**
 * FS request for browser
 */

export namespace FsStatRequest {
	export const type = new vscode.RequestType<vscode.DocumentUri, html.FileStat | undefined, unknown>('fs/stat');
}

export namespace FsReadFileRequest {
	export const type = new vscode.RequestType<vscode.DocumentUri, string | undefined, unknown>('fs/readFile');
}

export namespace FsReadDirectoryRequest {
	export const type = new vscode.RequestType<vscode.DocumentUri, [string, html.FileType][], unknown>('fs/readDirectory');
}

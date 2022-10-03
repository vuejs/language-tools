import * as vscode from 'vscode-languageserver-protocol';
import type * as html from 'vscode-html-languageservice';

/**
 * Server request client
 */

export namespace ShowReferencesNotification {
	export type ResponseType = vscode.TextDocumentPositionParams & { references: vscode.Location[]; };
	export const type = new vscode.NotificationType<ResponseType>('vue.findReferences');
}

/**
 * Client request server
 */

export namespace FindFileReferenceRequest {
	export type ParamsType = {
		textDocument: vscode.TextDocumentIdentifier;
	};
	export type ResponseType = vscode.Location[] | null | undefined;
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/findFileReference');
}

export namespace GetMatchTsConfigRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = { fileName: string, raw: any; } | null | undefined;
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

export namespace GetVirtualFileNamesRequest {
	export type ParamsType = vscode.TextDocumentIdentifier;
	export type ResponseType = string[];
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/virtualFileNames');
}

export namespace GetVirtualFileRequest {
	export type ParamsType = {
		sourceFileUri: string;
		virtualFileName: string;
	};
	export type ResponseType = {
		content: string;
		mappings: {
			sourceRange: [number, number];
			generatedRange: [number, number];
			data: undefined;
		}[];
	};
	export type ErrorType = never;
	export const type = new vscode.RequestType<ParamsType, ResponseType, ErrorType>('vue/virtualFile');
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

import * as rpc from 'vscode-jsonrpc';
import type * as vscode from 'vscode-languageserver';

/**
 * Client Requests
 */

 export namespace GetDocumentContentRequest {
	export const type: vscode.RequestType<string, string, any> = new rpc.RequestType('vscode/content');
}

export namespace GetDocumentVersionRequest {
	export const type: vscode.RequestType<{
		uri: string,
	}, number | undefined, any> = new rpc.RequestType('vue/docUpdated');
}

export namespace ShowReferencesNotification {
	export const type: vscode.NotificationType<{ uri: vscode.DocumentUri, position: vscode.Position, references: vscode.Location[] }> = new rpc.NotificationType('vue.findReferences');
}

export namespace GetDocumentNameCasesRequest {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, {
		tagNameCase: 'both' | 'kebabCase' | 'pascalCase',
		attrNameCase: 'kebabCase' | 'pascalCase',
	}, any> = new rpc.RequestType('volar/getAttrNameCaseClient');
}

export namespace GetDocumentSelectionRequest {
	export const type: vscode.RequestType0<{
		uri: string,
		offset: number,
	} | undefined, any> = new rpc.RequestType0('vue/activeSelection');
}

/**
 * Server Requests
 */

export namespace PingRequest {
	export const type: vscode.RequestType0<'pong' | null | undefined, any> = new rpc.RequestType0('volar/ping');
}

export namespace D3Request {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, string | null | undefined, any> = new rpc.RequestType('volar/d3');
}

export namespace GetTagCloseEditsRequest {
	export const type: vscode.RequestType<vscode.TextDocumentPositionParams, string | null | undefined, any> = new rpc.RequestType('html/tag');
}

export namespace GetRefCompleteEditsRequest {
	export const type: vscode.RequestType<vscode.TextDocumentPositionParams, string | null | undefined, any> = new rpc.RequestType('volar/ref');
}

export namespace VerifyAllScriptsRequest {
	export const type: vscode.RequestType<undefined, undefined, any> = new rpc.RequestType('volar.action.verifyAllScripts');
}

export namespace WriteVirtualFilesRequest {
	export const type: vscode.RequestType<{ lsType: 'template' | 'script' }, undefined, any> = new rpc.RequestType('volar.action.writeVirtualFiles');
}

export namespace RestartServerNotification {
	export const type: vscode.NotificationType<{
		serverPath: string,
		localizedPath: string | undefined,
	} | undefined> = new rpc.NotificationType('volar.action.restartServer');
}

export namespace DetectDocumentNameCasesRequest {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, {
		tag: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
		attr: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
	} | null | undefined, any> = new rpc.RequestType('volar/getTagNameCaseServer');
}

export namespace RemoveAllRefSugars {
	export const type: vscode.NotificationType<undefined> = new rpc.NotificationType('volar/removeAllRefSugars');
}

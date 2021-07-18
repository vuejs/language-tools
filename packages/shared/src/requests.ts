import type * as vscode from 'vscode-languageserver';
import * as rpc from 'vscode-jsonrpc';

export namespace PingRequest {
	export const type: vscode.RequestType0<'pong' | null | undefined, any> = new rpc.RequestType0('volar/ping');
}
export namespace VSCodeContentRequest {
	export const type: vscode.RequestType<string, string, any> = new rpc.RequestType('vscode/content');
}
export namespace D3Request {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, string | null | undefined, any> = new rpc.RequestType('volar/d3');
}
export namespace TagCloseRequest {
	export const type: vscode.RequestType<vscode.TextDocumentPositionParams, string | null | undefined, any> = new rpc.RequestType('html/tag');
}
export namespace RefCloseRequest {
	export const type: vscode.RequestType<vscode.TextDocumentPositionParams, string | null | undefined, any> = new rpc.RequestType('volar/ref');
}
export namespace DocumentVersionRequest {
	export const type: vscode.RequestType<{
		uri: string,
	}, number | undefined, any> = new rpc.RequestType('vue/docUpdated');
}
export namespace ActiveSelectionRequest {
	export const type: vscode.RequestType0<{
		uri: string,
		offset: number,
	} | undefined, any> = new rpc.RequestType0('vue/activeSelection');
}
export namespace VerifyAllScriptsRequest {
	export const type: vscode.RequestType<undefined, undefined, any> = new rpc.RequestType('volar.action.verifyAllScripts');
}
export namespace WriteVirtualFilesRequest {
	export const type: vscode.RequestType<{ lsType: 'template' | 'script' }, undefined, any> = new rpc.RequestType('volar.action.writeVirtualFiles');
}

export namespace RestartServerNotification {
	export const type: vscode.NotificationType<undefined> = new rpc.NotificationType('volar.action.restartServer');
}
export namespace ShowReferencesNotification {
	export const type: vscode.NotificationType<{ uri: vscode.DocumentUri, position: vscode.Position, references: vscode.Location[] }> = new rpc.NotificationType('vue.findReferences');
}
export namespace GetServerNameCasesRequest {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, {
		tag: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
		attr: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
	} | null | undefined, any> = new rpc.RequestType('volar/getTagNameCaseServer');
}
export namespace GetClientAttrNameCaseRequest {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, 'kebabCase' | 'pascalCase', any> = new rpc.RequestType('volar/getAttrNameCaseClient');
}
export namespace GetClientTarNameCaseRequest {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, 'both' | 'kebabCase' | 'pascalCase', any> = new rpc.RequestType('volar/getTagNameCaseClient');
}

// semantic tokens
export namespace RangeSemanticTokensRequest {
	export const type: vscode.RequestType<{
		textDocument: vscode.TextDocumentIdentifier;
		range: vscode.Range;
	}, vscode.SemanticTokens | undefined, any> = new rpc.RequestType('vue.semanticTokens');
}
export namespace SemanticTokenLegendRequest {
	export const type: vscode.RequestType0<vscode.SemanticTokensLegend, any> = new rpc.RequestType0('vue.semanticTokenLegend');
}
export namespace SemanticTokensChangedNotification {
	export const type: vscode.NotificationType0 = new rpc.NotificationType0('vue.semanticTokensChanged');
}
export namespace TsVersionChanged {
	export const type: vscode.NotificationType<string> = new rpc.NotificationType('volar.tsVersionChanged');
}
export namespace UseWorkspaceTsdkChanged {
	export const type: vscode.NotificationType<boolean> = new rpc.NotificationType('volar.useWorkspaceTsdkChanged');
}
export namespace RemoveAllRefSugars {
	export const type: vscode.NotificationType<undefined> = new rpc.NotificationType('volar/removeAllRefSugars');
}

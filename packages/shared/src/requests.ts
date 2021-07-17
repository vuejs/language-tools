import * as vscode from 'vscode-languageserver';

export namespace PingRequest {
	export const type: vscode.RequestType0<'pong' | null | undefined, any> = new vscode.RequestType0('volar/ping');
}
export namespace VSCodeContentRequest {
	export const type: vscode.RequestType<string, string, any> = new vscode.RequestType('vscode/content');
}
export namespace D3Request {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, string | null | undefined, any> = new vscode.RequestType('volar/d3');
}
export namespace TagCloseRequest {
	export const type: vscode.RequestType<vscode.TextDocumentPositionParams, string | null | undefined, any> = new vscode.RequestType('html/tag');
}
export namespace RefCloseRequest {
	export const type: vscode.RequestType<vscode.TextDocumentPositionParams, string | null | undefined, any> = new vscode.RequestType('volar/ref');
}
export namespace DocumentVersionRequest {
	export const type: vscode.RequestType<{
		uri: string,
	}, number | undefined, any> = new vscode.RequestType('vue/docUpdated');
}
export namespace ActiveSelectionRequest {
	export const type: vscode.RequestType0<{
		uri: string,
		offset: number,
	} | undefined, any> = new vscode.RequestType0('vue/activeSelection');
}
export namespace VerifyAllScriptsRequest {
	export const type: vscode.RequestType<undefined, undefined, any> = new vscode.RequestType('volar.action.verifyAllScripts');
}
export namespace WriteVirtualFilesRequest {
	export const type: vscode.RequestType<{ lsType: 'template' | 'script' }, undefined, any> = new vscode.RequestType('volar.action.writeVirtualFiles');
}

export namespace RestartServerNotification {
	export const type: vscode.NotificationType<undefined> = new vscode.NotificationType('volar.action.restartServer');
}
export namespace ShowReferencesNotification {
	export const type: vscode.NotificationType<{ uri: vscode.DocumentUri, position: vscode.Position, references: vscode.Location[] }> = new vscode.NotificationType('vue.findReferences');
}
export namespace GetServerNameCasesRequest {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, {
		tag: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
		attr: 'both' | 'kebabCase' | 'pascalCase' | 'unsure',
	} | null | undefined, any> = new vscode.RequestType('volar/getTagNameCaseServer');
}
export namespace GetClientAttrNameCaseRequest {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, 'kebabCase' | 'pascalCase', any> = new vscode.RequestType('volar/getAttrNameCaseClient');
}
export namespace GetClientTarNameCaseRequest {
	export const type: vscode.RequestType<vscode.TextDocumentIdentifier, 'both' | 'kebabCase' | 'pascalCase', any> = new vscode.RequestType('volar/getTagNameCaseClient');
}

// semantic tokens
export namespace RangeSemanticTokensRequest {
	export const type: vscode.RequestType<{
		textDocument: vscode.TextDocumentIdentifier;
		range: vscode.Range;
	}, vscode.SemanticTokens | undefined, any> = new vscode.RequestType('vue.semanticTokens');
}
export namespace SemanticTokenLegendRequest {
	export const type: vscode.RequestType0<vscode.SemanticTokensLegend, any> = new vscode.RequestType0('vue.semanticTokenLegend');
}
export namespace SemanticTokensChangedNotification {
	export const type: vscode.NotificationType0 = new vscode.NotificationType0('vue.semanticTokensChanged');
}
export namespace TsVersionChanged {
	export const type: vscode.NotificationType<string> = new vscode.NotificationType('volar.tsVersionChanged');
}
export namespace UseWorkspaceTsdkChanged {
	export const type: vscode.NotificationType<boolean> = new vscode.NotificationType('volar.useWorkspaceTsdkChanged');
}

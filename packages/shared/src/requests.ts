import { RequestType } from 'vscode-languageserver/node';
import { NotificationType } from 'vscode-languageserver/node';
import { TextDocumentPositionParams } from 'vscode-languageserver/node';
import { TextDocumentIdentifier } from 'vscode-languageserver/node';
import { FormattingOptions } from 'vscode-languageserver/node';
import { Position } from 'vscode-languageserver/node';
import { Location } from 'vscode-languageserver/node';
import { DocumentUri } from 'vscode-languageserver/node';
import { Range } from 'vscode-languageserver/node';
import { RequestType0 } from 'vscode-languageserver/node';
import { NotificationType0 } from 'vscode-languageserver/node';
import { SemanticTokensLegend } from 'vscode-languageserver/node';
import { SemanticTokens } from 'vscode-languageserver/node';

export namespace D3Request {
	export const type: RequestType<TextDocumentIdentifier, string | null | undefined, any> = new RequestType('volar/d3');
}
export namespace TagCloseRequest {
	export const type: RequestType<TextDocumentPositionParams, string | null | undefined, any> = new RequestType('html/tag');
}
export namespace RefCloseRequest {
	export const type: RequestType<TextDocumentPositionParams, string | null | undefined, any> = new RequestType('volar/ref');
}
export namespace DocumentVersionRequest {
	export const type: RequestType<{
		uri: string,
	}, number | undefined, any> = new RequestType('vue/docUpdated');
}
export namespace VerifyAllScriptsRequest {
	export const type: RequestType<undefined, undefined, any> = new RequestType('volar.action.verifyAllScripts');
}
export namespace FormatAllScriptsRequest {
	export const type: RequestType<FormattingOptions, undefined, any> = new RequestType('volar.action.formatAllScripts');
}
export namespace WriteVirtualFilesRequest {
	export const type: RequestType<undefined, undefined, any> = new RequestType('volar.action.writeVirtualFiles');
}
export namespace EmitDtsRequest {
	export const type: RequestType<{
		uri: string | undefined,
		dir: string | undefined,
		all: boolean,
	}, undefined, any> = new RequestType('volar.action.emitDts');
}

export namespace RestartServerNotification {
	export const type: NotificationType<undefined> = new NotificationType('volar.action.restartServer');
}
export namespace ShowReferencesNotification {
	export const type: NotificationType<{ uri: DocumentUri, position: Position, references: Location[] }> = new NotificationType('vue.findReferences');
}

// semantic tokens
export namespace RangeSemanticTokensRequest {
	export const type: RequestType<{
		textDocument: TextDocumentIdentifier;
		range: Range;
	}, SemanticTokens | undefined, any> = new RequestType('vue.semanticTokens');
}
export namespace SemanticTokenLegendRequest {
	export const type: RequestType0<SemanticTokensLegend, any> = new RequestType0('vue.semanticTokenLegend');
}
export namespace SemanticTokensChangedNotification {
	export const type: NotificationType0 = new NotificationType0('vue.semanticTokensChanged');
}

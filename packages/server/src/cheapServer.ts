import {
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	InitializeResult,
	createConnection,
} from 'vscode-languageserver/node';
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	TagCloseRequest,
	TagEditRequest,
} from '@volar/shared';
import { createNoStateLanguageService } from '@volar/vscode-vue-languageservice';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
connection.onInitialize(onInitialize);
documents.listen(connection);
connection.listen();

function onInitialize(params: InitializeParams) {
	if (params.rootPath) {
		initLanguageService();
	}
	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
		}
	};
	return result;
}
function initLanguageService() {

	const ls = createNoStateLanguageService();

	connection.onRequest(TagCloseRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return ls.doAutoClose(document, handler.position);
	});
	connection.onRequest(TagEditRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return ls.doAutoEditTag(document, handler.range);
	});
	connection.onDocumentFormatting(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return ls.doFormatting(document, handler.options);
	});
}

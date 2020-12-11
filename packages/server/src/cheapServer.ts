import {
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	InitializeResult,
	createConnection,
} from 'vscode-languageserver/node';
import { createLanguageServiceHost } from './languageServiceHost';
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	TagCloseRequest,
} from '@volar/shared';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
connection.onInitialize(onInitialize);
documents.listen(connection);
connection.listen();

function onInitialize(params: InitializeParams) {
	if (params.rootPath) {
		initLanguageService(params.rootPath);
	}
	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
		}
	};
	return result;
}
function initLanguageService(rootPath: string) {

	const host = createLanguageServiceHost(connection, documents, rootPath, false);

	connection.onRequest(TagCloseRequest.type, handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return host.best(document.uri)?.doAutoClose(document, handler.position);
	});
}

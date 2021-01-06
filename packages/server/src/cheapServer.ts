import {
	ProposedFeatures,
	InitializeParams,
	TextDocumentSyncKind,
	InitializeResult,
	createConnection,
	FoldingRangeRequest,
	TextDocumentRegistrationOptions,
	LinkedEditingRangeRequest,
	DocumentFormattingRequest,
} from 'vscode-languageserver/node';
import { TextDocuments } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
	TagCloseRequest,
} from '@volar/shared';
import { createNoStateLanguageService } from '@volar/vscode-vue-languageservice';
import { setTypescript } from '@volar/vscode-builtin-packages';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
connection.onInitialize(onInitialize);
connection.onInitialized(onInitialized);
documents.listen(connection);
connection.listen();

function onInitialize(params: InitializeParams) {
	setTypescript(params.initializationOptions.appRoot);
	initLanguageService();
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
	connection.onDocumentFormatting(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return ls.doFormatting(document, handler.options);
	});
	connection.onFoldingRanges(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return undefined;
		return ls.getFoldingRanges(document);
	});
	connection.languages.onLinkedEditingRange(handler => {
		const document = documents.get(handler.textDocument.uri);
		if (!document) return;
		return ls.findLinkedEditingRanges(document, handler.position);
	});
}
function onInitialized() {
	const vueOnly: TextDocumentRegistrationOptions = {
		documentSelector: [{ language: 'vue' }],
	};
	connection.client.register(FoldingRangeRequest.type, vueOnly);
	connection.client.register(LinkedEditingRangeRequest.type, vueOnly);
	connection.client.register(DocumentFormattingRequest.type, vueOnly);
}

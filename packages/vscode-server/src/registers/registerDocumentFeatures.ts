import {
    DocumentColorRequest,
    DocumentHighlightRequest,
    DocumentLinkRequest,
    DocumentSymbolRequest
} from 'vscode-languageserver/node';
import {
    connection,
    vueFileReg
} from '../instances';

connection.client.register(DocumentHighlightRequest.type, vueFileReg);
connection.client.register(DocumentSymbolRequest.type, vueFileReg);
connection.client.register(DocumentLinkRequest.type, vueFileReg);
connection.client.register(DocumentColorRequest.type, vueFileReg);

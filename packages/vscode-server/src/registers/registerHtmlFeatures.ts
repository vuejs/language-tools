import {
    DocumentFormattingRequest,
    FoldingRangeRequest,
    LinkedEditingRangeRequest
} from 'vscode-languageserver/node';
import {
    connection,
    vueDocReg
} from '../instances';

connection.client.register(FoldingRangeRequest.type, vueDocReg);
connection.client.register(LinkedEditingRangeRequest.type, vueDocReg);
connection.client.register(DocumentFormattingRequest.type, vueDocReg);

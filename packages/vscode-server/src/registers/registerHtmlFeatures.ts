import {
    Connection,
    DocumentFormattingRequest,
    FoldingRangeRequest,
    LinkedEditingRangeRequest
} from 'vscode-languageserver/node';
import {
    vueDocReg
} from '../features/shared';

export function register(connection: Connection) {
    connection.client.register(FoldingRangeRequest.type, vueDocReg);
    connection.client.register(LinkedEditingRangeRequest.type, vueDocReg);
    connection.client.register(DocumentFormattingRequest.type, vueDocReg);
}

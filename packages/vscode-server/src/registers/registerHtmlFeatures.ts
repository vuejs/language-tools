import * as vscode from 'vscode-languageserver';
import {
	vueDocReg
} from '../features/shared';

export function register(connection: vscode.Connection) {
	connection.client.register(vscode.FoldingRangeRequest.type, vueDocReg);
	connection.client.register(vscode.LinkedEditingRangeRequest.type, vueDocReg);
	connection.client.register(vscode.DocumentFormattingRequest.type, vueDocReg);
}

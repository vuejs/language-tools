import type * as vscode from 'vscode-languageserver';

export const vueDocReg: vscode.TextDocumentRegistrationOptions = {
	documentSelector: [
		{ language: 'vue' },
	],
};
export const vueFileReg: vscode.TextDocumentRegistrationOptions = {
	documentSelector: [
		{ scheme: 'file', language: 'vue' },
	],
};
export const allFilesReg: vscode.TextDocumentRegistrationOptions = {
	documentSelector: [
		{ scheme: 'file', language: 'vue' },
		{ scheme: 'file', language: 'javascript' },
		{ scheme: 'file', language: 'typescript' },
		{ scheme: 'file', language: 'javascriptreact' },
		{ scheme: 'file', language: 'typescriptreact' },
	],
};

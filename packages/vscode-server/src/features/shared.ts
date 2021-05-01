import { TextDocumentRegistrationOptions } from 'vscode-languageserver/node';

export const vueDocReg: TextDocumentRegistrationOptions = {
    documentSelector: [
        { language: 'vue' },
    ],
};
export const vueFileReg: TextDocumentRegistrationOptions = {
    documentSelector: [
        { scheme: 'file', language: 'vue' },
    ],
};
export const allFilesReg: TextDocumentRegistrationOptions = {
    documentSelector: [
        { scheme: 'file', language: 'vue' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'javascriptreact' },
        { scheme: 'file', language: 'typescriptreact' },
    ],
};

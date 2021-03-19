import {
    NoStateLanguageService
} from '@volar/vscode-vue-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    createConnection,
    ProposedFeatures,
    TextDocumentRegistrationOptions,
    TextDocuments
} from 'vscode-languageserver/node';
import { createLanguageServiceHost } from './languageServiceHost';

export const connection = createConnection(ProposedFeatures.all);
export const documents = new TextDocuments(TextDocument);
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

export let host: ReturnType<typeof createLanguageServiceHost> | undefined;
export let noStateLs: NoStateLanguageService | undefined;

export function setHost(_host: ReturnType<typeof createLanguageServiceHost>) {
    host = _host;
}
export function setNoStateLs(_noStateLs: NoStateLanguageService) {
    noStateLs = _noStateLs;
}

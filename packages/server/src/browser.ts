import * as vscode from 'vscode-languageserver/browser';
import { createLanguageServer } from './common';
import { configure as configureHttpRequests } from 'request-light';
import httpSchemaRequestHandler from './schemaRequestHandlers/http';
import * as ts from 'typescript/lib/tsserverlibrary'; // bundle typescript lib in web

const messageReader = new vscode.BrowserMessageReader(self);
const messageWriter = new vscode.BrowserMessageWriter(self);
const connection = vscode.createConnection(messageReader, messageWriter);

createLanguageServer(connection, {
    loadTypescript(options) {
        return ts; // not support load by user config in web
    },
    loadTypescriptLocalized(options) {
        // TODO
    },
    schemaRequestHandlers: {
        http: httpSchemaRequestHandler,
        https: httpSchemaRequestHandler,
    },
    onDidChangeConfiguration(settings) {
        configureHttpRequests(settings.http && settings.http.proxy, settings.http && settings.http.proxyStrictSSL);
    },
});

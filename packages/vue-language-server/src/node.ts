import * as vscode from 'vscode-languageserver/node';
import { createLanguageServer } from './common';
import { configure as configureHttpRequests } from 'request-light';
import fileSchemaRequestHandler from './schemaRequestHandlers/file';
import httpSchemaRequestHandler from './schemaRequestHandlers/http';
import * as path from 'upath';

const connection = vscode.createConnection(vscode.ProposedFeatures.all);

createLanguageServer(connection, {
    loadTypescript(options) {
        return require(path.toUnix(options.typescript.serverPath));
    },
    loadTypescriptLocalized(options) {
        if (options.typescript.localizedPath) {
            try {
                return require(path.toUnix(options.typescript.localizedPath));
            } catch { }
        }
    },
    schemaRequestHandlers: {
        file: fileSchemaRequestHandler,
        http: httpSchemaRequestHandler,
        https: httpSchemaRequestHandler,
    },
    onDidChangeConfiguration(settings) {
        configureHttpRequests(settings.http && settings.http.proxy, settings.http && settings.http.proxyStrictSSL);
    },
});

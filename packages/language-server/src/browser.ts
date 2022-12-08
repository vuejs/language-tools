import { configure as configureHttpRequests } from 'request-light';
import * as ts from 'typescript/lib/tsserverlibrary'; // bundle typescript lib in web
import * as vscode from 'vscode-languageserver/browser';
import { createCommonLanguageServer } from './server';
import { LanguageServerPlugin } from './types';
import httpSchemaRequestHandler from './schemaRequestHandlers/http';
import { createWebFileSystemHost } from './utils/webFileSystemHost';

export function createLanguageServer(plugins: LanguageServerPlugin[]) {

	const messageReader = new vscode.BrowserMessageReader(self);
	const messageWriter = new vscode.BrowserMessageWriter(self);
	const connection = vscode.createConnection(messageReader, messageWriter);

	createCommonLanguageServer(connection, {
		loadTypescript() {
			return ts; // not support load by user config in web
		},
		loadTypescriptLocalized() {
			// TODO
		},
		schemaRequestHandlers: {
			http: httpSchemaRequestHandler,
			https: httpSchemaRequestHandler,
		},
		onDidChangeConfiguration(settings) {
			configureHttpRequests(settings.http && settings.http.proxy, settings.http && settings.http.proxyStrictSSL);
		},
		fileSystemProvide: undefined, // TODO
		createFileSystemHost: createWebFileSystemHost,
	}, plugins);
}

export * from './index';

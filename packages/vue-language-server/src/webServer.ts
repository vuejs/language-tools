import { configure as configureHttpRequests } from 'request-light';
import * as ts from 'typescript/lib/tsserverlibrary'; // bundle typescript lib in web
import * as vscode from 'vscode-languageserver/browser';
import { createLanguageServer } from './commonServer';
import { languageConfigs } from './languageConfigs';
import httpSchemaRequestHandler from './schemaRequestHandlers/http';
import { createWebFileSystemHost } from './utils/webFileSystemHost';

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
	fileSystemProvide: undefined, // TODO
	createFileSystemHost: createWebFileSystemHost,
}, languageConfigs);

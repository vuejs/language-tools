import * as shared from '@volar/shared';
import * as fs from 'fs';
import { configure as configureHttpRequests } from 'request-light';
import * as path from 'upath';
import * as html from 'vscode-html-languageservice';
import * as vscode from 'vscode-languageserver/node';
import { createLanguageServer } from './common';
import fileSchemaRequestHandler from './schemaRequestHandlers/file';
import httpSchemaRequestHandler from './schemaRequestHandlers/http';
import { createNodeFileSystemHost } from './utils/nodeFileSystemHost';

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
	createFileSystemHost: createNodeFileSystemHost,
	fileSystemProvide: {
		stat: (uri) => {
			return new Promise<html.FileStat>((resolve, reject) => {
				fs.stat(shared.uriToFsPath(uri), (err, stats) => {
					if (stats) {
						resolve({
							type: stats.isFile() ? html.FileType.File
								: stats.isDirectory() ? html.FileType.Directory
									: stats.isSymbolicLink() ? html.FileType.SymbolicLink
										: html.FileType.Unknown,
							ctime: stats.ctimeMs,
							mtime: stats.mtimeMs,
							size: stats.size,
						});
					}
					else {
						reject(err);
					}
				});
			});
		},
		readDirectory: (uri) => {
			return new Promise<[string, html.FileType][]>((resolve, reject) => {
				fs.readdir(shared.uriToFsPath(uri), (err, files) => {
					if (files) {
						resolve(files.map(file => [file, html.FileType.File]));
					}
					else {
						reject(err);
					}
				});
			});
		},
	},
});

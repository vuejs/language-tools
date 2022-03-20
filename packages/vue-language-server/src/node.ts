import * as vscode from 'vscode-languageserver/node';
import { createLanguageServer } from './common';
import { configure as configureHttpRequests } from 'request-light';
import fileSchemaRequestHandler from './schemaRequestHandlers/file';
import httpSchemaRequestHandler from './schemaRequestHandlers/http';
import * as path from 'upath';
import * as html from 'vscode-html-languageservice';
import * as fs from 'fs';
import { URI } from 'vscode-uri';

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
    fileSystemProvide: {
        stat: (uri) => {
            const parsedUri = URI.parse(uri);
            return new Promise<html.FileStat>((resolve, reject) => {
                fs.stat(parsedUri.fsPath, (err, stats) => {
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
            const parsedUri = URI.parse(uri);
            return new Promise<[string, html.FileType][]>((resolve, reject) => {
                fs.readdir(parsedUri.fsPath, (err, files) => {
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

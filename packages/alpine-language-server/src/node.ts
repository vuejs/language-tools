import * as vscode from 'vscode-languageserver/node';
import { createLanguageServer } from '@volar/vue-language-server/out/common';
import * as alpine from '@volar/alpine-language-service';
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
	schemaRequestHandlers: {},
	onDidChangeConfiguration(settings) { },
	fileSystemProvide: undefined,
}, {
	definitelyExts: ['.html'],
	indeterminateExts: [],
	getDocumentService: (mods, configHost, _, plugins) => alpine.getDocumentService(mods, configHost, plugins),
	createLanguageService: (mods, lsHost, _1, _2, configHost, plugins) => alpine.createLanguageService(mods, lsHost, configHost, plugins),
});

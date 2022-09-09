import * as vscode from 'vscode-languageserver/node';
import { createLanguageServer } from '@volar/vue-language-server/out/commonServer';
import { createNodeFileSystemHost } from '@volar/vue-language-server/out/utils/nodeFileSystemHost';
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
	createFileSystemHost: createNodeFileSystemHost,
}, {
	definitelyExts: ['.html'],
	indeterminateExts: [],
	getDocumentService: alpine.getDocumentService,
	createLanguageService: (lsHost, env, customPlugins) => alpine.createLanguageService(lsHost, env, customPlugins ?? []),
});

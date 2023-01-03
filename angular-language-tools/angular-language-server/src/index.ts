import { createTsLanguageModule, createHtmlLanguageModule, HTMLTemplateFile } from '@volar-examples/angular-language-core';
import createTsPlugin from '@volar-plugins/typescript';
import { createConnection, startLanguageServer, LanguageServerPlugin } from '@volar/language-server/node';
import type { LanguageServicePlugin, Diagnostic } from '@volar/language-service';

const plugin: LanguageServerPlugin = () => ({
	extraFileExtensions: [{ extension: 'html', isMixedContent: true, scriptKind: 7 }],
	getLanguageModules(host) {
		const ts = host.getTypeScriptModule();
		if (ts) {
			return [
				createTsLanguageModule(ts),
				createHtmlLanguageModule(ts),
			];
		}
		return [];
	},
	getLanguageServicePlugins() {
		return [
			createTsPlugin(),
			ngTemplatePlugin,
		];
	},
});

const ngTemplatePlugin: LanguageServicePlugin = (context) => ({

	validation: {

		onSyntactic(document) {

			const file = context.documents.getVirtualFileByUri(document.uri);

			if (file instanceof HTMLTemplateFile) {
				return (file.parsed.errors ?? []).map<Diagnostic>(error => ({
					range: {
						start: { line: error.span.start.line, character: error.span.start.col },
						end: { line: error.span.end.line, character: error.span.end.col },
					},
					severity: error.level === 1 ? 1 : 2,
					source: 'ng-template',
					message: error.msg,
				}));
			}
		},
	}
});

startLanguageServer(createConnection(), plugin);

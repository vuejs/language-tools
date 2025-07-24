import type { DiagnosticSeverity, LanguageServicePlugin } from '@volar/language-service';
import { VueVirtualCode } from '@vue/language-core';
import { URI } from 'vscode-uri';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-global-types-error',
		capabilities: {
			diagnosticProvider: {
				interFileDependencies: false,
				workspaceDiagnostics: false,
			},
		},
		create(context) {
			return {
				provideDiagnostics(document) {
					if (document.languageId !== 'vue-root-tags') {
						return;
					}

					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					if (!sourceScript?.generated) {
						return;
					}

					const root = sourceScript.generated.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const { vueCompilerOptions } = root;
					const globalTypesPath = vueCompilerOptions.globalTypesPath(root.fileName);
					if (globalTypesPath) {
						return;
					}

					return [{
						range: {
							start: document.positionAt(0),
							end: document.positionAt(0),
						},
						severity: 2 satisfies typeof DiagnosticSeverity.Warning,
						code: 404,
						source: 'vue',
						message: `
Failed to write the global types file. Make sure that:

1. "node_modules" directory exists.
2. "${vueCompilerOptions.lib}" is installed as a direct dependency.

Alternatively, you can manually set "vueCompilerOptions.globalTypesPath" in your "tsconfig.json".

If all dependencies are installed, try running the "vue.action.restartServer" command to restart Vue and TS servers.
						`.trim(),
					}];
				},
			};
		},
	};
}

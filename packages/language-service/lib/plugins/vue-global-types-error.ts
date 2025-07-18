import type { DiagnosticSeverity, LanguageServicePlugin } from '@volar/language-service';
import { VueVirtualCode } from '@vue/language-core';
import { URI } from 'vscode-uri';

export function create(): LanguageServicePlugin {
	return {
		name: 'vue-compiler-dom-errors',
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
						severity: 1 satisfies typeof DiagnosticSeverity.Error,
						code: 404,
						source: 'vue',
						message:
							`Write global types file failed. Please ensure that "node_modules" exists and "${vueCompilerOptions.lib}" is a direct dependency, or set "vueCompilerOptions.globalTypesPath" in "tsconfig.json" manually.`,
					}];
				},
			};
		},
	};
}

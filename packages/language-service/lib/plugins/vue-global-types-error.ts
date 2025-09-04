import type { DiagnosticSeverity, LanguageServicePlugin } from '@volar/language-service';
import { resolveEmbeddedCode } from '../utils';

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
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'root_tags') {
						return;
					}
					if (info.script.id.scheme !== 'file') {
						return;
					}

					const { vueCompilerOptions } = info.root;
					const globalTypesPath = vueCompilerOptions.globalTypesPath(info.root.fileName);
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

Alternatively, you can manually set "vueCompilerOptions.globalTypesPath" in your "tsconfig.json" or "jsconfig.json".

If all dependencies are installed, try running the "vue.action.restartServer" command to restart Vue and TS servers.
						`.trim(),
					}];
				},
			};
		},
	};
}

import type { DiagnosticSeverity, LanguageServicePlugin } from '@volar/language-service';

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

					const vueCompilerOptions = context.project.vue?.compilerOptions;
					if (vueCompilerOptions && vueCompilerOptions.globalTypesPath === undefined) {
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
					}
				},
			};
		},
	};
}

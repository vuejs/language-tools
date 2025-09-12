import type { Diagnostic, DiagnosticSeverity, LanguageServicePlugin } from '@volar/language-service';
import { resolveEmbeddedCode } from '../utils';

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
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}

					const { template } = info.root.sfc;
					if (!template) {
						return;
					}

					const diagnostics: Diagnostic[] = [];

					for (
						const [errors, severity] of [
							[template.errors, 1 satisfies typeof DiagnosticSeverity.Error],
							[template.warnings, 2 satisfies typeof DiagnosticSeverity.Warning],
						] as const
					) {
						for (const error of errors) {
							diagnostics.push({
								range: {
									start: document.positionAt(error.loc?.start.offset ?? 0),
									end: document.positionAt(error.loc?.end.offset ?? 0),
								},
								severity,
								code: error.code,
								source: 'vue',
								message: error.message,
							});
						}
					}

					return diagnostics;
				},
			};
		},
	};
}

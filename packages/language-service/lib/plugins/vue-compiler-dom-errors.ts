import type { Diagnostic, DiagnosticSeverity, LanguageServicePlugin } from '@volar/language-service';
import { getEmbeddedInfo } from '../utils';

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
					const info = getEmbeddedInfo(context, document, 'template');
					if (!info) {
						return;
					}
					const { root } = info;

					const { template } = root.sfc;
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

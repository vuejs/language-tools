import type { Diagnostic, DiagnosticSeverity, LanguageServicePlugin, TextDocument } from '@volar/language-service';
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
					if (!isSupportedDocument(document)) {
						return;
					}

					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);

					const root = sourceScript?.generated?.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const templateErrors: Diagnostic[] = [];
					const { template } = root.sfc;

					if (template) {
						for (const error of template.errors) {
							onCompilerError(error, 1 satisfies typeof DiagnosticSeverity.Error);
						}

						for (const warning of template.warnings) {
							onCompilerError(warning, 2 satisfies typeof DiagnosticSeverity.Warning);
						}

						function onCompilerError(
							error: NonNullable<typeof template>['errors'][number],
							severity: DiagnosticSeverity,
						) {
							const templateHtmlRange = {
								start: error.loc?.start.offset ?? 0,
								end: error.loc?.end.offset ?? 0,
							};
							let errorMessage = error.message;

							templateErrors.push({
								range: {
									start: document.positionAt(templateHtmlRange.start),
									end: document.positionAt(templateHtmlRange.end),
								},
								severity,
								code: error.code,
								source: 'vue',
								message: errorMessage,
							});
						}
					}

					return templateErrors;
				},
			};
		},
	};

	function isSupportedDocument(document: TextDocument) {
		return document.languageId === 'jade' || document.languageId === 'html';
	}
}

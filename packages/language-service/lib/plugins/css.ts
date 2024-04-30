import type { LanguageServicePlugin, LanguageServicePluginInstance } from '@volar/language-service';
import { create as baseCreate } from 'volar-service-css';

export function create(): LanguageServicePlugin {
	const base = baseCreate({ scssDocumentSelector: ['scss', 'postcss'] });
	return {
		...base,
		create(context): LanguageServicePluginInstance {
			const baseInstance = base.create(context);
			return {
				...baseInstance,
				async provideDiagnostics(document, token) {
					let diagnostics = await baseInstance.provideDiagnostics?.(document, token) ?? [];
					if (document.languageId === 'postcss') {
						diagnostics = diagnostics.filter(diag => diag.code !== 'css-semicolonexpected');
						diagnostics = diagnostics.filter(diag => diag.code !== 'css-ruleorselectorexpected');
						diagnostics = diagnostics.filter(diag => diag.code !== 'unknownAtRules');
					}
					return diagnostics;
				},
			};
		},
	};
}

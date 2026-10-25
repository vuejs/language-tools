import type { LanguageServicePlugin } from '@volar/language-service';
import { create as createEmmetPlugin } from 'volar-service-emmet';
import { resolveEmbeddedCode } from '../utils';
import { getExpressionStartAt } from './vue-template-expressions';

/**
 * Emmet, except in the template expressions of the HTML template, which are JavaScript. Emmet completes only the
 * first embedded document at the position, which is not the template when a script code generation plugin maps the
 * expression to its script.
 */
export function create(ts: typeof import('typescript')): LanguageServicePlugin {
	const plugin = createEmmetPlugin({
		mappedLanguages: {
			'vue-root-tags': 'html',
			'postcss': 'scss',
		},
	});
	return {
		...plugin,
		create(context) {
			const instance = plugin.create(context);
			return {
				...instance,
				provideCompletionItems(document, position, completionContext, token) {
					const info = resolveEmbeddedCode(context, document.uri);
					const ast = info?.root.ir.template?.ast;
					if (
						info?.code.id === 'template' && ast
						&& getExpressionStartAt(ts, ast, document.offsetAt(position), []) !== undefined
					) {
						return;
					}
					return instance.provideCompletionItems?.(document, position, completionContext, token);
				},
			};
		},
	};
}

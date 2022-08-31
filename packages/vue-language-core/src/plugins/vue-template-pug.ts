import { VueLanguagePlugin } from '../sourceFile';
import * as CompilerDom from '@vue/compiler-dom';
import * as CompilerVue2 from '../utils/vue2TemplateCompiler';

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {

	return {

		compileSFCTemplate(lang, template, options) {

			if (lang === 'pug') {

				let pug: typeof import('@volar/pug-language-service') | undefined;

				try {
					pug = require('@volar/pug-language-service');
				} catch { }

				const pugDoc = pug?.baseParse(template);

				if (pugDoc) {

					const compiler = vueCompilerOptions.target < 3 ? CompilerVue2 : CompilerDom;
					const completed = compiler.compile(pugDoc.htmlCode, {
						...options,
						...vueCompilerOptions.experimentalTemplateCompilerOptions,
						onWarn(warning) {
							options?.onWarn?.(createProxyObject(warning));
						},
						onError(error) {
							options?.onError?.(createProxyObject(error));
						},
					});

					return createProxyObject(completed);

					function createProxyObject(target: any): any {
						return new Proxy(target, {
							get(target, prop) {
								if (prop === 'offset') {
									const htmlOffset = target.offset;
									const pugOffset = pugDoc!.sourceMap.getSourceRange(htmlOffset, htmlOffset, data => !data?.isEmptyTagCompletion)?.[0]?.start;
									return pugOffset ?? -1;
								}
								const value = target[prop];
								if (typeof value === 'object') {
									return createProxyObject(target[prop]);
								}
								return value;
							}
						});
					}
				}
			}
		},
	};
};
export = plugin;

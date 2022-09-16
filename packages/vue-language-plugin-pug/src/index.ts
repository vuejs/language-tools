import type { VueLanguagePlugin } from '@volar/vue-language-core';
import * as pug from '@volar/pug-language-service';

const plugin: VueLanguagePlugin = ({ modules, vueCompilerOptions }) => {

	return {

		compileSFCTemplate(lang, template, options) {

			if (lang === 'pug') {

				const pugDoc = pug?.baseParse(template);

				if (pugDoc) {

					const compiler = modules['@vue/compiler-dom'];
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

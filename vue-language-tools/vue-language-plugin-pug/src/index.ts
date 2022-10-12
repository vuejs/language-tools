import type { VueLanguagePlugin } from '@volar/vue-language-core';
import * as pug from '@volar/pug-language-service';
import { SourceMapBase } from '@volar/source-map';
import { MappingKind } from '@volar/pug-language-service';

const plugin: VueLanguagePlugin = ({ modules }) => {

	return {

		name: require('../package.json').name,

		version: 1,

		compileSFCTemplate(lang, template, options) {

			if (lang === 'pug') {

				const pugFile = pug?.baseParse(template);
				const map = new SourceMapBase(pugFile.mappings);

				if (pugFile) {

					const compiler = modules['@vue/compiler-dom'];
					const completed = compiler.compile(pugFile.htmlCode, {
						...options,
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
									for (const mapped of map.toSourceOffsets(htmlOffset)) {
										if (mapped[1].data !== MappingKind.EmptyTagCompletion) {
											return mapped[0];
										}
									}
									return -1;
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

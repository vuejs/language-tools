import type { VueLanguagePlugin } from '@vue/language-core';
import * as pug from 'volar-service-pug/lib/languageService';
import { SourceMap } from '@volar/source-map';

const plugin: VueLanguagePlugin = ({ modules }) => {

	return {

		name: require('./package.json').name,

		version: 2.1,

		compileSFCTemplate(lang, template, options) {

			if (lang === 'pug') {

				const pugFile = pug?.baseParse(template);
				const map = new SourceMap(pugFile.mappings);

				if (pugFile) {

					const compiler = modules['@vue/compiler-dom'];
					const completed = compiler.compile(pugFile.htmlCode, {
						...options,
						comments: true,
						onWarn(warning) {
							options?.onWarn?.(createProxyObject(warning));
						},
						onError(error) {
							options?.onError?.(createProxyObject(error));
						},
					});

					return createProxyObject(completed);

					function createProxyObject(target: any): any {
						const proxys = new WeakMap();
						return new Proxy(target, {
							get(target, prop, receiver) {
								if (prop === 'getClassOffset') {
									// div.foo#baz.bar
									//     ^^^     ^^^
									// class=" foo bar"
									//         ^^^ ^^^
									// NOTE: we need to expose source offset getter
									return function(startOffset: number) {
										return getOffset(target.offset + startOffset);
									};
								}
								if (prop === 'offset') {
									return getOffset(target.offset);
								}
								const value = Reflect.get(target, prop, receiver);
								if (typeof value === 'object' && value !== null) {
									let proxyed = proxys.get(value)
									if (proxyed) {
										return proxyed;
									}
									proxyed = createProxyObject(value);
									proxys.set(value, proxyed);
									return proxyed;
								}
								return value;
							}
						});
					}

					function getOffset(offset: number) {
						const htmlOffset = offset;
						const nums: number[] = [];
						for (const mapped of map.toSourceLocation(htmlOffset)) {
							nums.push(mapped[0]);
						}
						return Math.max(-1, ...nums);
					}
				}
			}
		},
	};
};
export = plugin;

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
						return new Proxy(target, {
							get(target, prop) {
								if (prop === 'value' && target.name === 'class') {
									return createClassProxyObject(target[prop]);
								}
								if (prop === 'offset') {
									const htmlOffset = target.offset;
									const nums: number[] = [];
									for (const mapped of map.toSourceLocation(htmlOffset)) {
										nums.push(mapped[0]);
									}
									return Math.max(-1, ...nums);
								}
								const value = target[prop];
								if (typeof value === 'object') {
									return createProxyObject(target[prop]);
								}
								return value;
							}
						});
					}

					function createClassProxyObject(target: any): any {
						return new Proxy(target, {
							get(target, prop) {
								if (prop === 'offset') {
									// class=" foo"
									//       ^^
									const htmlOffset = target.offset + 2;
									const nums: number[] = [];
									for (const mapped of map.toSourceLocation(htmlOffset)) {
										nums.push(mapped[0]);
									}
									return Math.max(-1, ...nums) - 2;
								}
								const value = target[prop];
								if (typeof value === 'object') {
									return createClassProxyObject(target[prop]);
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

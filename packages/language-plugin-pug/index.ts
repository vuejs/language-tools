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
								if (prop === 'value' && target.name === 'class') {
									return createClassProxyObject(target[prop]);
								}
								if (prop === 'offset') {
									return getOffset(target.offset);
								}
								const value = Reflect.get(target, prop, receiver);
								if (typeof value === 'object' && value !== null) {
									return getCachedProxy(proxys, value, () => createProxyObject(value));
								}
								return value;
							}
						});
					}

					function createClassProxyObject(target: any): any {
						const proxys = new WeakMap();
						return new Proxy(target, {
							get(target, prop, receiver) {
								if (prop === 'offset') {
									// class=" foo"
									//       ^^
									return getOffset(target.offset, 2);
								}
								const value = Reflect.get(target, prop, receiver);
								if (typeof value === 'object' && value !== null) {
									return getCachedProxy(proxys, value, () => createClassProxyObject(value));
								}
								return value;
							}
						});
					}

					function getOffset(offset: number, startOffset = 0) {
						const htmlOffset = offset + startOffset;
						const nums: number[] = [];
						for (const mapped of map.toSourceLocation(htmlOffset)) {
							nums.push(mapped[0]);
						}
						return Math.max(-1, ...nums) - startOffset;
					}

					function getCachedProxy<K extends object, V>(
						proxys: WeakMap<K, V>,
						key: K,
						defaultValue: () => V
					) {
						let proxyed = proxys.get(key)
						if (proxyed) {
							return proxyed;
						}
						proxyed = defaultValue();
						proxys.set(key, proxyed);
						return proxyed;
					}
				}
			}
		},
	};
};
export = plugin;

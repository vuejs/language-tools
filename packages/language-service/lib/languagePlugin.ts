import { createVuePlugins, type LanguagePlugin, type TypeScript, type VueCompilerOptions } from '@vue/language-core';
import { getRootLanguageId, VueVirtualCode } from './virtualCode';

export function createVueLanguagePlugin<T>(
	ts: TypeScript,
	vueCompilerOptions: VueCompilerOptions,
	asFileName: (scriptId: T) => string,
): LanguagePlugin<T, VueVirtualCode> {
	const plugins = createVuePlugins(ts, vueCompilerOptions);

	return {
		// Every file passed in is parsed by `vueCompilerOptions.format`; the host routes to this plugin only the
		// files of the `contentMappers` entry it was created for.
		getLanguageId() {
			return getRootLanguageId(vueCompilerOptions);
		},
		createVirtualCode(scriptId, _languageId, snapshot) {
			return new VueVirtualCode(asFileName(scriptId), snapshot, vueCompilerOptions, plugins, ts);
		},
		updateVirtualCode(_scriptId, code, snapshot) {
			code.update(snapshot);
			return code;
		},
	};
}

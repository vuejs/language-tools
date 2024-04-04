import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as vue from '@vue/language-core';

const windowsPathReg = /\\/g;

export function run() {

	let runExtensions = ['.vue'];

	const extensionsChangedException = new Error('extensions changed');
	const main = () => runTsc(
		require.resolve('typescript/lib/tsc'),
		runExtensions,
		(ts, options) => {
			const { configFilePath } = options.options;
			const vueOptions = typeof configFilePath === 'string'
				? vue.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathReg, '/')).vueOptions
				: vue.resolveVueCompilerOptions({});
			if (
				runExtensions.length === vueOptions.extensions.length
				&& runExtensions.every(ext => vueOptions.extensions.includes(ext))
			) {
				const writeFile = options.host!.writeFile.bind(options.host);
				options.host!.writeFile = (fileName, contents, ...args) => {
					if (
						fileName.endsWith('.d.ts')
						&& vueLanguagePlugin
							.getCanonicalFileName(fileName.replace(windowsPathReg, '/'))
							.slice(0, -5) === vueLanguagePlugin.pluginContext.globalTypesHolder
					) {
						contents = removeEmitGlobalTypes(contents);
					}
					return writeFile(fileName, contents, ...args);
				};
				const vueLanguagePlugin = vue.createVueLanguagePlugin(
					ts,
					id => id,
					options.host?.useCaseSensitiveFileNames?.() ?? false,
					() => '',
					() => options.rootNames.map(rootName => rootName.replace(windowsPathReg, '/')),
					options.options,
					vueOptions,
					false,
				);
				return [vueLanguagePlugin];
			}
			else {
				runExtensions = vueOptions.extensions;
				throw extensionsChangedException;
			}
		},
		fileName => {
			if (runExtensions.some(ext => fileName.endsWith(ext))) {
				return 'vue';
			}
			return vue.resolveCommonLanguageId(fileName);
		},
	);

	try {
		main();
	} catch (err) {
		if (err === extensionsChangedException) {
			main();
		}
	}
}

export function removeEmitGlobalTypes(dts: string) {
	return dts.replace(/[^\n]*__VLS_globalTypesStart[\w\W]*__VLS_globalTypesEnd[^\n]*\n/, '');
}

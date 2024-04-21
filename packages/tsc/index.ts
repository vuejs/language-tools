import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as vue from '@vue/language-core';
import * as path from 'path';

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
					if (!vueLanguagePlugin.pluginContext.globalTypesHolder) {
						return writeFile(fileName, contents, ...args);
					}

					const writeFileName = path.basename(vueLanguagePlugin.getCanonicalFileName(fileName));
					const globalTypesFileName = path.basename(vueLanguagePlugin.getCanonicalFileName(vueLanguagePlugin.pluginContext.globalTypesHolder));
					return writeFile(fileName, writeFileName.startsWith(globalTypesFileName) ? removeEmitGlobalTypes(contents) : contents, ...args);
				};
				const vueLanguagePlugin = vue.createVueLanguagePlugin(
					ts,
					id => id,
					options.host?.useCaseSensitiveFileNames?.() ?? false,
					() => '',
					() => options.rootNames.map(rootName => rootName.replace(windowsPathReg, '/')),
					options.options,
					vueOptions,
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

const removeEmitGlobalTypesRegexp = /[^\n]*__VLS_globalTypesStart[\w\W]*__VLS_globalTypesEnd[^\n]*\n/g;

export function removeEmitGlobalTypes(dts: string) {
	return dts.replace(removeEmitGlobalTypesRegexp, '');
}

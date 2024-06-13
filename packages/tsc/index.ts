import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as vue from '@vue/language-core';
import { createCliOptions } from './options';

const windowsPathReg = /\\/g;

export function run() {

	let runExtensions = ['.vue'];

	const customOptions = createCliOptions();

	const extensionsChangedException = new Error('extensions changed');
	const main = () => runTsc(
		require.resolve('typescript/lib/tsc'),
		runExtensions,
		(ts, options) => {
			const { configFilePath } = options.options;
			const vueOptions = typeof configFilePath === 'string'
				? vue.createParsedCommandLine(ts, ts.sys, (customOptions?.project || configFilePath).replace(windowsPathReg, '/')).vueOptions
				: vue.resolveVueCompilerOptions({});
			const allExtensions = [
				...vueOptions.extensions,
				...vueOptions.vitePressExtensions,
				...vueOptions.petiteVueExtensions,
			];
			if (
				runExtensions.length === allExtensions.length
				&& runExtensions.every(ext => allExtensions.includes(ext))
			) {
				const writeFile = options.host!.writeFile.bind(options.host);
				options.host!.writeFile = (fileName, contents, ...args) => {
					return writeFile(fileName, removeEmitGlobalTypes(contents), ...args);
				};
				const vueLanguagePlugin = vue.createVueLanguagePlugin<string>(
					ts,
					id => id,
					() => '',
					fileName => {
						const fileMap = new vue.FileMap(options.host?.useCaseSensitiveFileNames?.() ?? false);
						for (const vueFileName of options.rootNames.map(rootName => rootName.replace(windowsPathReg, '/'))) {
							fileMap.set(vueFileName, undefined);
						}
						return fileMap.has(fileName);
					},
					options.options,
					vueOptions
				);
				return [vueLanguagePlugin];
			}
			else {
				runExtensions = allExtensions;
				throw extensionsChangedException;
			}
		}
	);

	try {
		main();
	} catch (err) {
		if (err === extensionsChangedException) {
			main();
		} else {
			console.error(err);
		}
	}
}

const removeEmitGlobalTypesRegexp = /^[^\n]*__VLS_globalTypesStart[\w\W]*__VLS_globalTypesEnd[^\n]*\n?$/mg;

export function removeEmitGlobalTypes(dts: string) {
	return dts.replace(removeEmitGlobalTypesRegexp, '');
}

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
			const allExtensions = vue.getAllExtensions(vueOptions);
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
					vue.createRootFileChecker(
						undefined,
						() => options.rootNames.map(rootName => rootName.replace(windowsPathReg, '/')),
						options.host?.useCaseSensitiveFileNames?.() ?? false
					),
					options.options,
					vueOptions
				);
				return { languagePlugins: [vueLanguagePlugin] };
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

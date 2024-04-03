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
			const writeFile = options.host!.writeFile.bind(options.host);
			const getCanonicalFileName = options.host?.useCaseSensitiveFileNames?.()
				? (fileName: string) => fileName
				: (fileName: string) => fileName.toLowerCase();
			const canonicalRootFileNames = new Set(
				options.rootNames
					.map(rootName => rootName.replace(windowsPathReg, '/'))
					.map(getCanonicalFileName)
			);
			const canonicalGlobalTypesHolderFileNames = new Set<string>();
			options.host!.writeFile = (fileName, contents, ...args) => {
				if (
					fileName.endsWith('.d.ts')
					&& canonicalGlobalTypesHolderFileNames.has(getCanonicalFileName(fileName.replace(windowsPathReg, '/')).slice(0, -5))
				) {
					contents = removeEmitGlobalTypes(contents);
				}
				return writeFile(fileName, contents, ...args);
			};
			if (
				runExtensions.length === vueOptions.extensions.length
				&& runExtensions.every(ext => vueOptions.extensions.includes(ext))
			) {
				const vueLanguagePlugin = vue.createVueLanguagePlugin(
					ts,
					id => id,
					fileName => {
						const canonicalFileName = getCanonicalFileName(fileName);
						canonicalGlobalTypesHolderFileNames.add(canonicalFileName);
						return canonicalRootFileNames.has(canonicalFileName);
					},
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

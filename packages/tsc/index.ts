import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as path from 'path';
import * as vue from '@vue/language-core';

const windowsPathReg = /\\/g;

export function run(tscPath = require.resolve('typescript/lib/tsc')) {

	let runExtensions = ['.vue'];

	const extensionsChangedException = new Error('extensions changed');
	const main = () => runTsc(
		tscPath,
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
				try {
					let dir = typeof configFilePath === 'string'
						? configFilePath
						: options.host?.getCurrentDirectory() ?? ts.sys.getCurrentDirectory();
					while (!ts.sys.directoryExists(path.resolve(dir, 'node_modules'))) {
						const parentDir = path.resolve(dir, '..');
						if (dir === parentDir) {
							throw 0;
						}
						dir = parentDir;
					}
					const globalTypesPath = path.resolve(dir, `node_modules/.vue-global-types/${vueOptions.lib}_${vueOptions.target}_${vueOptions.strictTemplates}.d.ts`);
					const globalTypesContents = vue.generateGlobalTypes(vueOptions.lib, vueOptions.target, vueOptions.strictTemplates);
					ts.sys.writeFile(globalTypesPath, globalTypesContents);
				} catch { }

				const vueLanguagePlugin = vue.createVueLanguagePlugin<string>(
					ts,
					options.options,
					vueOptions,
					id => id
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
			throw err;
		}
	}
}

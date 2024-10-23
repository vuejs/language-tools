import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
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

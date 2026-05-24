import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as core from '@vue/language-core';

const windowsPathReg = /\\/g;

export function run(tscPath = require.resolve('typescript/lib/tsc')) {
	let runExtensions = ['.vue'];
	let extensionsChangedException: Error | undefined;

	const main = () =>
		runTsc(
			tscPath,
			runExtensions,
			(ts, options) => {
				const { configFilePath } = options.options;
				const vueOptions = typeof configFilePath === 'string'
					? core.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathReg, '/')).vueOptions
					: core.createParsedCommandLineByJson(ts, ts.sys, (options.host ?? ts.sys).getCurrentDirectory(), {})
						.vueOptions;
				const allExtensions = core.getAllExtensions(vueOptions);
				if (
					runExtensions.length === allExtensions.length
					&& runExtensions.every(ext => allExtensions.includes(ext))
				) {
					const vueLanguagePlugin = core.createVueLanguagePlugin<string>(
						ts,
						options.options,
						vueOptions,
						id => id,
					);
					return { languagePlugins: [vueLanguagePlugin] };
				}
				else {
					runExtensions = allExtensions;
					throw extensionsChangedException = new Error('extensions changed');
				}
			},
		);

	try {
		return main();
	}
	catch (err) {
		if (err === extensionsChangedException) {
			return main();
		}
		else {
			throw err;
		}
	}
}

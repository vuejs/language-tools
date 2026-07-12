import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as core from '@vue/language-core';
import * as path from 'node:path';

const windowsPathRE = /\\/g;

export function run(tscPath?: string) {
	let runExtensions = ['.vue'];
	let extensionsChangedException: Error | undefined;

	const main = () =>
		runTsc(
			resolveTscPath(tscPath),
			runExtensions,
			(ts, options) => {
				const { configFilePath } = options.options;
				const vueOptions = typeof configFilePath === 'string'
					? core.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathRE, '/')).vueOptions
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

function resolveTscPath(tscPath = require.resolve('typescript/lib/tsc')) {
	try {
		// `tsserver.js` is only present in the original `typescript` package
		require.resolve(path.join(tscPath, '..', 'tsserver'));
		return tscPath;
	}
	catch {
		// `typescript` may be aliased to `@typescript/typescript6`,
		// which keeps tsc in its full TypeScript 6 dependency (`@typescript/old`)
		return require.resolve('@typescript/old/lib/tsc', {
			paths: [path.dirname(tscPath)],
		});
	}
}

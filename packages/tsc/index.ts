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

// `@typescript/typescript6` (the TypeScript 7 era JS API package) only
// re-exports the real compiler from its `@typescript/old` dependency
function resolveTscPath(tscPath = require.resolve('typescript/lib/tsc')) {
	try {
		const { name } = require(path.join(tscPath, '..', '..', 'package.json'));
		if (name === '@typescript/typescript6') {
			return require.resolve('@typescript/old/lib/tsc', { paths: [path.dirname(tscPath)] });
		}
	}
	catch {}
	return tscPath;
}

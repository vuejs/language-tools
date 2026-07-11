import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as core from '@vue/language-core';
import * as fs from 'node:fs';
import * as path from 'node:path';

const windowsPathRE = /\\/g;

export function run(tscPath = require.resolve('typescript/lib/tsc')) {
	tscPath = resolvePatchableTsc(tscPath);
	let runExtensions = ['.vue'];
	let extensionsChangedException: Error | undefined;

	const main = () =>
		runTsc(
			tscPath,
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
// re-exports the real compiler from its `@typescript/old` dependency;
// `runTsc` needs the real source to patch
function resolvePatchableTsc(tscPath: string) {
	try {
		const pkg = JSON.parse(
			fs.readFileSync(path.join(tscPath, '..', '..', 'package.json'), 'utf8'),
		);
		if (pkg.name === '@typescript/typescript6') {
			return require.resolve('@typescript/old/lib/tsc.js', { paths: [path.dirname(tscPath)] });
		}
	}
	catch {}
	return tscPath;
}

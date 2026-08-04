import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as core from '@vue/language-core';
import * as path from 'node:path';

const windowsPathRE = /\\/g;
const retryToken = Symbol();

export function run(tscPath?: string) {
	const runExtensions = new Set(['vue']);

	const main = () =>
		runTsc(
			resolveTscPath(tscPath),
			[...runExtensions],
			(ts, options) => {
				const { configFilePath } = options.options;
				const vueOptions = typeof configFilePath === 'string'
					? core.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathRE, '/')).vueOptions
					: core.createParsedCommandLineByJson(ts, ts.sys, (options.host ?? ts.sys).getCurrentDirectory(), {})
						.vueOptions;
				const allExtensions = core.getAllExtensions(vueOptions);
				if (allExtensions.every(ext => runExtensions.has(ext))) {
					const vueLanguagePlugin = core.createVueLanguagePlugin<string>(
						ts,
						options.options,
						vueOptions,
						id => id,
					);
					return { languagePlugins: [vueLanguagePlugin] };
				}
				else {
					for (const ext of allExtensions) {
						runExtensions.add(ext);
					}
					throw retryToken;
				}
			},
		);

	while (true) {
		try {
			return main();
		}
		catch (err) {
			if (err !== retryToken) {
				throw err;
			}
		}
	}
}

function resolveTscPath(tscPath = require.resolve('typescript/lib/tsc')) {
	try {
		const { name } = require(path.join(tscPath, '..', '..', 'package.json'));
		if (name === '@typescript/typescript6') {
			// `typescript` may be aliased to `@typescript/typescript6`,
			// which keeps tsc in its full TypeScript 6 dependency (`@typescript/old`)
			return require.resolve('@typescript/old/lib/tsc', { paths: [path.dirname(tscPath)] });
		}
	}
	catch {}
	return tscPath;
}

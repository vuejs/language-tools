import { runTsc } from '@volar/typescript/lib/starters/runTsc';
import * as vue from '@vue/language-core';

let runExtensions = ['.vue'];

const windowsPathReg = /\\/g;
const extensionsChangedException = new Error('extensions changed');
const main = () => runTsc(require.resolve('typescript/lib/tsc'), runExtensions, (ts, options) => {
	const { configFilePath } = options.options;
	const vueOptions = typeof configFilePath === 'string'
		? vue.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathReg, '/')).vueOptions
		: {};
	const extensions = vueOptions.extensions ?? ['.vue'];
	if (
		runExtensions.length === extensions.length
		&& runExtensions.every(ext => extensions.includes(ext))
	) {
		return vue.createLanguages(
			ts,
			options.options,
			vueOptions,
		);
	}
	else {
		runExtensions = extensions;
		throw extensionsChangedException;
	}
});

try {
	main();
} catch (err) {
	if (err === extensionsChangedException) {
		main();
	}
}

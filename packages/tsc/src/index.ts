import * as vue from '@vue/language-core';
import { runTsc } from '@volar/typescript/lib/starters/runTsc';

const windowsPathReg = /\\/g;

runTsc(require.resolve('typescript/lib/tsc'), ['.vue'], (ts, options) => {
	const { configFilePath } = options.options;
	const vueOptions = typeof configFilePath === 'string'
		? vue.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathReg, '/')).vueOptions
		: {};
	return vue.createLanguages(
		ts,
		options.options,
		vueOptions,
	);
});

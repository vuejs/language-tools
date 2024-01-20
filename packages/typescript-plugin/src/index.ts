import { createTSServerPlugin } from '@volar/typescript/lib/quickstart/createTSServerPlugin';
import * as vue from '@vue/language-core';
import type * as _ from 'typescript';

const windowsPathReg = /\\/g;

export = createTSServerPlugin((ts, info) => {
	const vueOptions = vue.resolveVueCompilerOptions(getVueCompilerOptions());
	const languagePlugins = vue.createLanguages(
		ts,
		id => id,
		info.languageServiceHost.getCompilationSettings(),
		vueOptions,
	);
	const getCompletionsAtPosition = info.languageService.getCompletionsAtPosition;

	info.languageService.getCompletionsAtPosition = (fileName, position, options) => {
		const result = getCompletionsAtPosition(fileName, position, options);
		if (result) {
			result.entries = result.entries.filter(entry => entry.name.indexOf('__VLS_') === -1);
		}
		return result;
	};

	return languagePlugins;

	function getVueCompilerOptions() {
		if (info.project.projectKind === ts.server.ProjectKind.Configured) {
			const tsconfig = info.project.getProjectName();
			return vue.createParsedCommandLine(ts, ts.sys, tsconfig.replace(windowsPathReg, '/')).vueOptions;
		}
		else {
			return vue.createParsedCommandLineByJson(ts, ts.sys, info.languageServiceHost.getCurrentDirectory(), {}).vueOptions;
		}
	}
});

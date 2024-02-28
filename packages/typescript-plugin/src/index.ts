import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin';
import * as vue from '@vue/language-core';
import type * as _ from 'typescript';

const windowsPathReg = /\\/g;

export = createLanguageServicePlugin((ts, info) => {
	const vueOptions = vue.resolveVueCompilerOptions(getVueCompilerOptions());
	const languagePlugin = vue.createVueLanguagePlugin(
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

	return [languagePlugin];

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

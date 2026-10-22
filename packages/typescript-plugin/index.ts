import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin';
import * as core from '@vue/language-core';
import type * as ts from 'typescript';
import { postprocessLanguageService, preprocessLanguageService } from './lib/common';
import { getExtensionFormats } from './lib/contentMappers';

export = createLanguageServicePlugin(
	(ts, info) => {
		const configFileName = info.project.projectKind === ts.server.ProjectKind.Configured
			? info.project.getProjectName().replace(/\\/g, '/')
			: undefined;
		const vueOptions = configFileName
			? core.createParsedCommandLine(ts, ts.sys, configFileName).vueOptions
			: core.createParsedCommandLineByJson(ts, ts.sys, info.languageServiceHost.getCurrentDirectory(), {}).vueOptions;
		const extensionFormats = getExtensionFormats(ts, ts.sys, configFileName);
		const extensions = Object.keys(extensionFormats);
		// Each file goes to the plugin of its longest matching extension, parsed by that extension's format.
		const languagePlugins = Object.entries(extensionFormats)
			.sort(([a], [b]) => b.length - a.length)
			.map(([extension, format]): core.LanguagePlugin<string> => {
				const vuePlugin = core.createVueLanguagePlugin<string>(ts, { ...vueOptions, format }, id => id);
				return {
					...vuePlugin,
					getLanguageId: fileName => fileName.endsWith(extension) ? vuePlugin.getLanguageId(fileName) : undefined,
					createVirtualCode: (fileName, languageId, snapshot, ctx) =>
						fileName.endsWith(extension)
							? vuePlugin.createVirtualCode!(fileName, languageId, snapshot, ctx)
							: undefined,
					typescript: {
						...vuePlugin.typescript!,
						extraFileExtensions: [{
							extension: extension.slice(1),
							isMixedContent: true,
							scriptKind: 7 satisfies ts.ScriptKind.Deferred,
						}],
					},
				};
			});

		let _language: core.Language<string> | undefined;
		info.languageService = preprocessLanguageService(info.languageService, () => _language);

		return {
			languagePlugins,
			setup: language => {
				_language = language;
				info.languageService = postprocessLanguageService(
					ts,
					language,
					info.languageService,
					vueOptions,
					extensions,
					fileName => fileName,
				);
				(info.project as any).__vue__ = { language, vueOptions, extensions };
			},
		};
	},
);

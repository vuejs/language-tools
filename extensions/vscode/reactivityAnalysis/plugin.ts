import { createProxyLanguageService, decorateLanguageServiceHost } from '@volar/typescript';
import type { Language, SourceScript } from '@vue/language-core';
import { createAnalyzer } from 'laplacenoma';
// @ts-expect-error
import rulesVue from 'laplacenoma/rules/vue';
import type * as ts from 'typescript';

const plugin: ts.server.PluginModuleFactory = module => {
	const { typescript: ts } = module;

	return {
		create(info) {
			if (!info.session || (info.session as any).handlers.has('_vue:getReactivityAnalysis')) {
				return info.languageService;
			}

			info.session.addProtocolHandler('_vue:getReactivityAnalysis', request => {
				const [fileName, position] = request.arguments;
				// @ts-expect-error
				const { project } = info.session.getFileAndProject({
					file: fileName,
					projectFileName: undefined,
				}) as {
					file: ts.server.NormalizedPath;
					project: ts.server.Project;
				};

				let response;
				const language = project['program']?.__vue__?.language as Language<string> | undefined;
				if (language) {
					const sourceScript = language.scripts.get(fileName);
					if (sourceScript) {
						response = getReactivityAnalysis(
							ts,
							language,
							sourceScript,
							position,
							sourceScript.generated ? sourceScript.snapshot.getLength() : 0,
						);
					}
				}

				return {
					response,
					responseRequired: true,
				};
			});

			return info.languageService;
		},
	};
};

module.exports = plugin;

const analyzer = createAnalyzer({
	rules: rulesVue,
});

let currentVersion = -1;
let currentFileName = '';
let currentSnapshot: ts.IScriptSnapshot | undefined;
let languageService: ts.LanguageService | undefined;
let languageServiceHost: ts.LanguageServiceHost | undefined;

export type ReactivityAnalysisReturns = ReturnType<typeof getReactivityAnalysis>;

function getReactivityAnalysis(
	ts: typeof import('typescript'),
	language: Language<string>,
	sourceScript: SourceScript<string>,
	position: number,
	leadingOffset: number = 0,
) {
	if (currentSnapshot !== sourceScript.snapshot || currentFileName !== sourceScript.id) {
		currentSnapshot = sourceScript.snapshot;
		currentFileName = sourceScript.id;
		currentVersion++;
	}
	if (!languageService) {
		languageServiceHost = {
			getProjectVersion: () => currentVersion.toString(),
			getScriptVersion: () => currentVersion.toString(),
			getScriptFileNames: () => [currentFileName],
			getScriptSnapshot: fileName => fileName === currentFileName ? currentSnapshot : undefined,
			getCompilationSettings: () => ({ allowJs: true, allowNonTsExtensions: true }),
			getCurrentDirectory: () => '',
			getDefaultLibFileName: () => '',
			readFile: () => undefined,
			fileExists: fileName => fileName === currentFileName,
		};
		decorateLanguageServiceHost(ts, language, languageServiceHost);
		const proxied = createProxyLanguageService(ts.createLanguageService(languageServiceHost));
		proxied.initialize(language);
		languageService = proxied.proxy;
	}

	const sourceFile = languageService.getProgram()!.getSourceFile(sourceScript.id)!;
	const serviceScript = sourceScript.generated?.languagePlugin.typescript?.getServiceScript(
		sourceScript.generated.root,
	);
	const map = serviceScript ? language.maps.get(serviceScript.code, sourceScript) : undefined;
	const toSourceRange = map
		? (pos: number, end: number) => {
			for (const [mappedStart, mappedEnd] of map.toSourceRange(pos - leadingOffset, end - leadingOffset, false)) {
				return { pos: mappedStart, end: mappedEnd };
			}
		}
		: (pos: number, end: number) => ({ pos, end });

	return analyzer.analyze(sourceFile, position, {
		typescript: ts,
		languageService,
		toSourceRange,
	});
}

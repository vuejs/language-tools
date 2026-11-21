import { createProxyLanguageService, decorateLanguageServiceHost } from '@volar/typescript';
import { forEachEmbeddedCode, type Language } from '@vue/language-core';
import { createAnalyzer } from 'laplacenoma';
import rulesVue from 'laplacenoma/rules/vue';
import type * as ts from 'typescript';

// The single-file host reads scripts through the `language` it was decorated with, which in turn
// reads them through that project's host. Reusing one service across projects would make tsserver
// attach every analyzed file to the first project, so keep one service per project.
const languageServices = new WeakMap<Language<string>, ReturnType<typeof createSingleFileLanguageService>>();

const analyzer = createAnalyzer({ rules: rulesVue });
const plugin: ts.server.PluginModuleFactory = ({ typescript: ts }) => {
	return {
		create(info) {
			if (info.session && !(info.session as any).handlers.has('_vue:getReactivityAnalysis')) {
				info.session.addProtocolHandler('_vue:getReactivityAnalysis', request => {
					const [fileName, position]: [string, number] = request.arguments;
					return {
						response: getReactivityAnalysis(ts, info.session!, fileName, position),
						responseRequired: true,
					};
				});
				info.session.addProtocolHandler('_vue:getInterpolationRanges', request => {
					const [fileName]: [string] = request.arguments;
					return {
						response: getInterpolationRanges(info.session!, fileName),
						responseRequired: true,
					};
				});
			}

			return info.languageService;
		},
	};
};

export = plugin;

function getReactivityAnalysis(
	ts: typeof import('typescript'),
	session: ts.server.Session,
	fileName: string,
	position: number,
) {
	const { project } = session['getFileAndProject']({
		file: fileName,
		projectFileName: undefined,
	}) as {
		file: ts.server.NormalizedPath;
		project: ts.server.Project;
	};

	const language: Language<string> | undefined = (project as any).__vue__?.language;
	if (!language) {
		return;
	}

	const sourceScript = language.scripts.get(fileName);
	if (!sourceScript) {
		return;
	}

	let service = languageServices.get(language);
	if (!service) {
		languageServices.set(language, service = createSingleFileLanguageService(ts, language));
	}
	if (service.snapshot !== sourceScript.snapshot || service.fileName !== sourceScript.id) {
		service.snapshot = sourceScript.snapshot;
		service.fileName = sourceScript.id;
		service.version++;
	}

	const { languageService } = service;
	const sourceFile = languageService.getProgram()!.getSourceFile(sourceScript.id)!;
	const serviceScript = sourceScript.generated?.languagePlugin.typescript?.getServiceScript(
		sourceScript.generated.root,
	);
	const map = serviceScript ? language.maps.get(serviceScript.code, sourceScript) : undefined;
	const leadingOffset = sourceScript.generated ? sourceScript.snapshot.getLength() : 0;
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

function createSingleFileLanguageService(
	ts: typeof import('typescript'),
	language: Language<string>,
) {
	const state = {
		version: -1,
		fileName: '',
		snapshot: undefined as ts.IScriptSnapshot | undefined,
	};
	const languageServiceHost: ts.LanguageServiceHost = {
		getProjectVersion: () => state.version.toString(),
		getScriptVersion: () => state.version.toString(),
		getScriptFileNames: () => [state.fileName],
		getScriptSnapshot: fileName => fileName === state.fileName ? state.snapshot : undefined,
		getCompilationSettings: () => ({ allowJs: true, allowNonTsExtensions: true }),
		getCurrentDirectory: () => '',
		getDefaultLibFileName: () => '',
		readFile: () => undefined,
		fileExists: fileName => fileName === state.fileName,
	};
	decorateLanguageServiceHost(ts, language, languageServiceHost);
	const proxied = createProxyLanguageService(ts.createLanguageService(languageServiceHost));
	proxied.initialize(language);
	return Object.assign(state, { languageService: proxied.proxy });
}

function getInterpolationRanges(
	session: ts.server.Session,
	fileName: string,
) {
	const { project } = session['getFileAndProject']({
		file: fileName,
		projectFileName: undefined,
	}) as {
		file: ts.server.NormalizedPath;
		project: ts.server.Project;
	};

	const language: Language<string> | undefined = (project as any).__vue__?.language;
	if (!language) {
		return;
	}

	const sourceScript = language.scripts.get(fileName);
	if (!sourceScript?.generated) {
		return;
	}

	const ranges: [number, number][] = [];
	for (const code of forEachEmbeddedCode(sourceScript.generated.root)) {
		const codeText = code.snapshot.getText(0, code.snapshot.getLength());
		if (
			(
				code.id.startsWith('template_inline_ts_')
				&& codeText.startsWith('0 +')
				&& codeText.endsWith('+ 0;')
			)
			|| (code.id.startsWith('style_') && code.id.endsWith('_inline_ts'))
		) {
			for (const mapping of code.mappings) {
				for (let i = 0; i < mapping.sourceOffsets.length; i++) {
					ranges.push([
						mapping.sourceOffsets[i]!,
						mapping.sourceOffsets[i]! + mapping.lengths[i]!,
					]);
				}
			}
		}
	}
	return ranges;
}

import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'path';
import type { VueCompilerOptions, ResolvedVueCompilerOptions } from '../types';

export type ParsedCommandLine = ts.ParsedCommandLine & {
	vueOptions: VueCompilerOptions;
};

export function createParsedCommandLineByJson(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	rootDir: string,
	json: any,
	extraFileExtensions: ts.FileExtensionInfo[],
): ParsedCommandLine {

	const tsConfigPath = path.join(rootDir, 'jsconfig.json');
	const content = ts.parseJsonConfigFileContent(json, parseConfigHost, rootDir, {}, tsConfigPath, undefined, extraFileExtensions);

	return createParsedCommandLineBase(ts, parseConfigHost, content, tsConfigPath, extraFileExtensions, new Set());
}

export function createParsedCommandLine(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	tsConfigPath: string,
	extraFileExtensions: ts.FileExtensionInfo[],
	extendsSet = new Set<string>(),
): ParsedCommandLine {

	const config = ts.readJsonConfigFile(tsConfigPath, parseConfigHost.readFile);
	const content = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, path.dirname(tsConfigPath), {}, tsConfigPath, undefined, extraFileExtensions);
	// fix https://github.com/johnsoncodehk/volar/issues/1786
	// https://github.com/microsoft/TypeScript/issues/30457
	// patching ts server broke with outDir + rootDir + composite/incremental
	content.options.outDir = undefined;

	return createParsedCommandLineBase(ts, parseConfigHost, content, tsConfigPath, extraFileExtensions, extendsSet);
}

function createParsedCommandLineBase(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	content: ts.ParsedCommandLine,
	tsConfigPath: string,
	extraFileExtensions: ts.FileExtensionInfo[],
	extendsSet: Set<string>,
): ParsedCommandLine {

	let baseVueOptions = {};
	const folder = path.dirname(tsConfigPath);

	extendsSet.add(tsConfigPath);

	if (content.raw.extends) {
		try {
			const extendsPath = require.resolve(content.raw.extends, { paths: [folder] });
			if (!extendsSet.has(extendsPath)) {
				baseVueOptions = createParsedCommandLine(ts, parseConfigHost, extendsPath, extraFileExtensions, extendsSet).vueOptions;
			}
		}
		catch (error) {
			console.error(error);
		}
	}

	return {
		...content,
		vueOptions: {
			...baseVueOptions,
			...resolveVueCompilerOptionsWorker(content.raw.vueCompilerOptions ?? {}, folder),
		},
	};
}

export function resolveVueCompilerOptions(vueOptions: VueCompilerOptions): ResolvedVueCompilerOptions {
	const target = vueOptions.target ?? 3;
	return {
		...vueOptions,

		target,
		jsxTemplates: vueOptions.jsxTemplates ?? false,
		strictTemplates: vueOptions.strictTemplates ?? false,
		skipTemplateCodegen: vueOptions.skipTemplateCodegen ?? false,
		dataAttributes: vueOptions.dataAttributes ?? ['data-*'],
		htmlAttributes: vueOptions.htmlAttributes ?? ['aria-*'],
		optionsWrapper: vueOptions.optionsWrapper ?? (
			target >= 2.7
				? [`(await import('vue')).defineComponent(`, `)`]
				: [`(await import('vue')).default.extend(`, `)`]
		),
		narrowingTypesInInlineHandlers: vueOptions.narrowingTypesInInlineHandlers ?? false,
		plugins: vueOptions.plugins ?? [],
		bypassDefineComponentToExposePropsAndEmitsForJsScriptSetupComponents: vueOptions.bypassDefineComponentToExposePropsAndEmitsForJsScriptSetupComponents ?? true,

		// experimental
		experimentalRuntimeMode: vueOptions.experimentalRuntimeMode ?? 'runtime-dom',
		experimentalTemplateCompilerOptions: vueOptions.experimentalTemplateCompilerOptions ?? {},
		experimentalTemplateCompilerOptionsRequirePath: vueOptions.experimentalTemplateCompilerOptionsRequirePath ?? undefined,
		experimentalResolveStyleCssClasses: vueOptions.experimentalResolveStyleCssClasses ?? 'scoped',
		experimentalRfc436: vueOptions.experimentalRfc436 ?? false,
	};
}

function resolveVueCompilerOptionsWorker(rawOptions: {
	[key: string]: any,
	experimentalTemplateCompilerOptionsRequirePath?: string,
}, rootPath: string) {

	const result = { ...rawOptions };

	let templateOptionsPath = rawOptions.experimentalTemplateCompilerOptionsRequirePath;
	if (templateOptionsPath) {
		if (!path.isAbsolute(templateOptionsPath)) {
			templateOptionsPath = require.resolve(templateOptionsPath, { paths: [rootPath] });
		}
		try {
			result.experimentalTemplateCompilerOptions = require(templateOptionsPath).default;
		} catch (error) {
			console.warn('Failed to require "experimentalTemplateCompilerOptionsRequirePath":', templateOptionsPath);
			console.error(error);
		}
	}

	return result;
}

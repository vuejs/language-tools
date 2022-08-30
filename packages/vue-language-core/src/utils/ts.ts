import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'path';
import type { VueCompilerOptions, _VueCompilerOptions } from '../types';

export type ParsedCommandLine = ts.ParsedCommandLine & {
	vueOptions: VueCompilerOptions;
};

export function createParsedCommandLineByJson(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	rootDir: string,
	json: any,
): ParsedCommandLine {

	const rootDirPath = ts.sys.resolvePath(rootDir);
	const tsConfigPath = ts.sys.resolvePath(path.join(rootDir, 'jsconfig.json'));
	const content = ts.parseJsonConfigFileContent(json, parseConfigHost, rootDirPath, {}, tsConfigPath);

	return createParsedCommandLineBase(ts, parseConfigHost, content, tsConfigPath, new Set());
}

export function createParsedCommandLine(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	tsConfig: string,
	extendsSet = new Set<string>(),
): ParsedCommandLine {

	const tsConfigPath = ts.sys.resolvePath(tsConfig);
	const config = ts.readJsonConfigFile(tsConfigPath, ts.sys.readFile);
	const content = ts.parseJsonSourceFileConfigFileContent(config, parseConfigHost, path.dirname(tsConfigPath), {}, path.basename(tsConfigPath));
	// fix https://github.com/johnsoncodehk/volar/issues/1786
	// https://github.com/microsoft/TypeScript/issues/30457
	// patching ts server broke with outDir + rootDir + composite/incremental
	content.options.outDir = undefined;

	return createParsedCommandLineBase(ts, parseConfigHost, content, tsConfigPath, extendsSet);
}

function createParsedCommandLineBase(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	content: ts.ParsedCommandLine,
	tsConfigPath: string,
	extendsSet: Set<string>,
): ParsedCommandLine {

	let baseVueOptions = {};
	const folder = path.dirname(tsConfigPath);

	extendsSet.add(tsConfigPath);

	if (content.raw.extends) {
		try {
			const extendsPath = require.resolve(content.raw.extends, { paths: [folder] });
			if (!extendsSet.has(extendsPath)) {
				baseVueOptions = createParsedCommandLine(ts, parseConfigHost, extendsPath, extendsSet).vueOptions;
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
			...resolveVueCompilerOptions(content.raw.vueCompilerOptions ?? {}, folder),
		},
	};
}

export function getVueCompilerOptions(vueOptions: VueCompilerOptions): _VueCompilerOptions {
	return {
		...vueOptions,

		target: vueOptions.target ?? 3,
		strictTemplates: vueOptions.strictTemplates ?? false,
		plugins: vueOptions.plugins ?? [],

		// experimental
		experimentalRuntimeMode: vueOptions.experimentalRuntimeMode ?? 'runtime-dom',
		experimentalImplicitWrapComponentOptionsWithDefineComponent: vueOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent ?? 'onlyJs',
		experimentalImplicitWrapComponentOptionsWithVue2Extend: vueOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend ?? 'onlyJs',
		experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup: vueOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup ?? 'onlyJs',
		experimentalTemplateCompilerOptions: vueOptions.experimentalTemplateCompilerOptions ?? {},
		experimentalTemplateCompilerOptionsRequirePath: vueOptions.experimentalTemplateCompilerOptionsRequirePath ?? undefined,
		experimentalDisableTemplateSupport: vueOptions.experimentalDisableTemplateSupport ?? false,
		experimentalResolveStyleCssClasses: vueOptions.experimentalResolveStyleCssClasses ?? 'scoped',
		experimentalAllowTypeNarrowingInInlineHandlers: vueOptions.experimentalAllowTypeNarrowingInInlineHandlers ?? false,
	};
}

function resolveVueCompilerOptions(rawOptions: {
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

import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'path';
import type { RawVueCompilerOptions, VueCompilerOptions, VueLanguagePlugin } from '../types';

export type ParsedCommandLine = ts.ParsedCommandLine & {
	vueOptions: Partial<VueCompilerOptions>;
};

export function createParsedCommandLineByJson(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	rootDir: string,
	json: any,
	extraFileExtensions: ts.FileExtensionInfo[],
): ParsedCommandLine {

	const tsConfigPath = path.join(rootDir, 'jsconfig.json');
	const proxyHost = proxyParseConfigHostForExtendConfigPaths(parseConfigHost);
	const content = ts.parseJsonConfigFileContent(json, proxyHost.host, rootDir, {}, tsConfigPath, undefined, extraFileExtensions);

	let vueOptions: Partial<VueCompilerOptions> = {};

	for (const extendPath of proxyHost.extendConfigPaths.reverse()) {
		try {
			vueOptions = {
				...vueOptions,
				...getVueCompilerOptions(ts, ts.readJsonConfigFile(extendPath, proxyHost.host.readFile)),
			};
		} catch (err) { }
	}

	return {
		...content,
		vueOptions,
	};
}

export function createParsedCommandLine(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	tsConfigPath: string,
	extraFileExtensions: ts.FileExtensionInfo[],
): ParsedCommandLine {
	try {
		const proxyHost = proxyParseConfigHostForExtendConfigPaths(parseConfigHost);
		const config = ts.readJsonConfigFile(tsConfigPath, proxyHost.host.readFile);
		const content = ts.parseJsonSourceFileConfigFileContent(config, proxyHost.host, path.dirname(tsConfigPath), {}, tsConfigPath, undefined, extraFileExtensions);
		// fix https://github.com/johnsoncodehk/volar/issues/1786
		// https://github.com/microsoft/TypeScript/issues/30457
		// patching ts server broke with outDir + rootDir + composite/incremental
		content.options.outDir = undefined;

		let vueOptions: Partial<VueCompilerOptions> = {};

		for (const extendPath of proxyHost.extendConfigPaths.reverse()) {
			try {
				vueOptions = {
					...vueOptions,
					...getVueCompilerOptions(ts, ts.readJsonConfigFile(extendPath, proxyHost.host.readFile)),
				};
			} catch (err) { }
		}

		return {
			...content,
			vueOptions,
		};
	}
	catch (err) {
		console.warn('Failed to resolve tsconfig path:', tsConfigPath, err);
		return {
			fileNames: [],
			options: {},
			vueOptions: {},
			errors: [],
		};
	}
}

function proxyParseConfigHostForExtendConfigPaths(parseConfigHost: ts.ParseConfigHost) {
	const extendConfigPaths: string[] = [];
	const host = new Proxy(parseConfigHost, {
		get(target, key) {
			if (key === 'readFile') {
				return (fileName: string) => {
					if (!fileName.endsWith('/package.json') && !extendConfigPaths.includes(fileName)) {
						extendConfigPaths.push(fileName);
					}
					return target.readFile(fileName);
				};
			}
			return target[key as keyof typeof target];
		}
	});
	return {
		host,
		extendConfigPaths,
	};
}

function getVueCompilerOptions(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsConfigSourceFile: ts.TsConfigSourceFile,
): Partial<VueCompilerOptions> {

	const folder = path.dirname(tsConfigSourceFile.fileName);
	const obj = ts.convertToObject(tsConfigSourceFile, []);
	const rawOptions: RawVueCompilerOptions = obj?.vueCompilerOptions ?? {};
	const result: Partial<VueCompilerOptions> = {
		...rawOptions as any,
	};
	const target = rawOptions.target ?? 'auto';

	if (target === 'auto') {
		const resolvedPath = resolvePath('vue/package.json');
		if (resolvedPath) {
			const vuePackageJson = require(resolvedPath);
			const versionNumbers = vuePackageJson.version.split('.');
			result.target = Number(versionNumbers[0] + '.' + versionNumbers[1]);
		}
		else {
			// console.warn('Load vue/package.json failed from', folder);
		}
	}
	else {
		result.target = target;
	}
	if (rawOptions.plugins) {
		const plugins = rawOptions.plugins
			.map<VueLanguagePlugin | undefined>((pluginPath: string) => {
				try {
					const resolvedPath = resolvePath(pluginPath);
					if (resolvedPath) {
						return require(resolvedPath);
					}
				}
				catch (error) {
					console.warn('Load plugin failed', pluginPath, error);
				}
			})
			.filter((plugin): plugin is NonNullable<typeof plugin> => !!plugin);

		result.plugins = plugins;
	}
	if (rawOptions.hooks) {
		result.hooks = rawOptions.hooks
			.map(resolvePath)
			.filter((hook): hook is NonNullable<typeof hook> => !!hook);
	}
	if (rawOptions.experimentalAdditionalLanguageModules) {
		result.experimentalAdditionalLanguageModules = rawOptions.experimentalAdditionalLanguageModules
			.map(resolvePath)
			.filter((module): module is NonNullable<typeof module> => !!module);
	}

	return result;

	function resolvePath(scriptPath: string): string | undefined {
		try {
			if (require?.resolve) {
				return require.resolve(scriptPath, { paths: [folder] });
			}
			else {
				// console.warn('failed to resolve path:', scriptPath, 'require.resolve is not supported in web');
			}
		}
		catch (error) {
			// console.warn(error);
		}
	}
}

export function resolveVueCompilerOptions(vueOptions: Partial<VueCompilerOptions>): VueCompilerOptions {
	const target = vueOptions.target ?? 3.3;
	return {
		...vueOptions,
		target,
		extensions: vueOptions.extensions ?? ['.vue'],
		jsxSlots: vueOptions.jsxSlots ?? false,
		strictTemplates: vueOptions.strictTemplates ?? false,
		skipTemplateCodegen: vueOptions.skipTemplateCodegen ?? false,
		dataAttributes: vueOptions.dataAttributes ?? [],
		htmlAttributes: vueOptions.htmlAttributes ?? ['aria-*'],
		optionsWrapper: vueOptions.optionsWrapper ?? (
			target >= 2.7
				? [`(await import('vue')).defineComponent(`, `)`]
				: [`(await import('vue')).default.extend(`, `)`]
		),
		macros: vueOptions.macros ?? {
			defineProps: ['defineProps'],
			defineSlots: ['defineSlots'],
			defineEmits: ['defineEmits'],
			defineExpose: ['defineExpose'],
			withDefaults: ['withDefaults'],
		},
		plugins: vueOptions.plugins ?? [],
		hooks: vueOptions.hooks ?? [],

		// experimental
		experimentalDefinePropProposal: vueOptions.experimentalDefinePropProposal ?? false,
		experimentalAdditionalLanguageModules: vueOptions.experimentalAdditionalLanguageModules ?? [],
		experimentalResolveStyleCssClasses: vueOptions.experimentalResolveStyleCssClasses ?? 'scoped',
		// https://github.com/vuejs/vue-next/blob/master/packages/compiler-dom/src/transforms/vModel.ts#L49-L51
		// https://vuejs.org/guide/essentials/forms.html#form-input-bindings
		experimentalModelPropName: vueOptions.experimentalModelPropName ?? {
			'': {
				input: true
			},
			value: {
				input: { type: 'text' },
				textarea: true,
				select: true
			}
		},
		experimentalUseElementAccessInTemplate: vueOptions.experimentalUseElementAccessInTemplate ?? false,
	};
}

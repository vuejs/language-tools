import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'path-browserify';
import type { RawVueCompilerOptions, VueCompilerOptions, VueLanguagePlugin } from '../types';

export type ParsedCommandLine = ts.ParsedCommandLine & {
	vueOptions: Partial<VueCompilerOptions>;
};

export function createParsedCommandLineByJson(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	rootDir: string,
	json: any,
	configFileName = rootDir + '/jsconfig.json'
): ParsedCommandLine {

	const proxyHost = proxyParseConfigHostForExtendConfigPaths(parseConfigHost);
	ts.parseJsonConfigFileContent(json, proxyHost.host, rootDir, {}, configFileName);

	let vueOptions: Partial<VueCompilerOptions> = {};

	for (const extendPath of proxyHost.extendConfigPaths.reverse()) {
		try {
			vueOptions = {
				...vueOptions,
				...getPartialVueCompilerOptions(ts, ts.readJsonConfigFile(extendPath, proxyHost.host.readFile)),
			};
		} catch (err) { }
	}

	const parsed = ts.parseJsonConfigFileContent(
		json,
		proxyHost.host,
		rootDir,
		{},
		configFileName,
		undefined,
		(vueOptions.extensions ?? ['.vue']).map(extension => ({
			extension: extension.slice(1),
			isMixedContent: true,
			scriptKind: ts.ScriptKind.Deferred,
		})),
	);

	// fix https://github.com/vuejs/language-tools/issues/1786
	// https://github.com/microsoft/TypeScript/issues/30457
	// patching ts server broke with outDir + rootDir + composite/incremental
	parsed.options.outDir = undefined;

	return {
		...parsed,
		vueOptions,
	};
}

export function createParsedCommandLine(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	parseConfigHost: ts.ParseConfigHost,
	tsConfigPath: string,
): ParsedCommandLine {
	try {
		const proxyHost = proxyParseConfigHostForExtendConfigPaths(parseConfigHost);
		const config = ts.readJsonConfigFile(tsConfigPath, proxyHost.host.readFile);
		ts.parseJsonSourceFileConfigFileContent(config, proxyHost.host, path.dirname(tsConfigPath), {}, tsConfigPath);

		let vueOptions: Partial<VueCompilerOptions> = {};

		for (const extendPath of proxyHost.extendConfigPaths.reverse()) {
			try {
				vueOptions = {
					...vueOptions,
					...getPartialVueCompilerOptions(ts, ts.readJsonConfigFile(extendPath, proxyHost.host.readFile)),
				};
			} catch (err) { }
		}

		const parsed = ts.parseJsonSourceFileConfigFileContent(
			config,
			proxyHost.host,
			path.dirname(tsConfigPath),
			{},
			tsConfigPath,
			undefined,
			(vueOptions.extensions ?? ['.vue']).map(extension => ({
				extension: extension.slice(1),
				isMixedContent: true,
				scriptKind: ts.ScriptKind.Deferred,
			})),
		);

		// fix https://github.com/vuejs/language-tools/issues/1786
		// https://github.com/microsoft/TypeScript/issues/30457
		// patching ts server broke with outDir + rootDir + composite/incremental
		parsed.options.outDir = undefined;

		return {
			...parsed,
			vueOptions,
		};
	}
	catch (err) {
		// console.warn('Failed to resolve tsconfig path:', tsConfigPath, err);
		return {
			fileNames: [],
			options: {},
			vueOptions: resolveVueCompilerOptions({}),
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

function getPartialVueCompilerOptions(
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
			.map<VueLanguagePlugin[] | VueLanguagePlugin>((pluginPath: string) => {
				try {
					const resolvedPath = resolvePath(pluginPath);
					if (resolvedPath) {
						return require(resolvedPath);
					}
					else {
						console.warn('Load plugin failed:', pluginPath);
					}
				}
				catch (error) {
					console.warn('Load plugin failed:', pluginPath, error);
				}
				return [];
			})
			.flat(Infinity as 1);

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

// https://developer.mozilla.org/en-US/docs/Web/HTML/Element
const HTML_TAGS =
	'html,body,base,head,link,meta,style,title,address,article,aside,footer,' +
	'header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,' +
	'figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,' +
	'data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,' +
	'time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,' +
	'canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,' +
	'th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,' +
	'option,output,progress,select,textarea,details,dialog,menu,' +
	'summary,template,blockquote,iframe,tfoot';

// https://developer.mozilla.org/en-US/docs/Web/SVG/Element
const SVG_TAGS =
	'svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,' +
	'defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,' +
	'feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,' +
	'feDistanceLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,' +
	'feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,' +
	'fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,' +
	'foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,' +
	'mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,' +
	'polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,' +
	'text,textPath,title,tspan,unknown,use,view';

export function resolveVueCompilerOptions(vueOptions: Partial<VueCompilerOptions>): VueCompilerOptions {
	const target = vueOptions.target ?? 3.3;
	const lib = vueOptions.lib || (target < 2.7 ? '@vue/runtime-dom' : 'vue');
	return {
		...vueOptions,
		target,
		extensions: vueOptions.extensions ?? ['.vue'],
		lib,
		jsxSlots: vueOptions.jsxSlots ?? false,
		strictTemplates: vueOptions.strictTemplates ?? false,
		skipTemplateCodegen: vueOptions.skipTemplateCodegen ?? false,
		nativeTags: vueOptions.nativeTags ?? [...new Set([
			...HTML_TAGS.split(','),
			...SVG_TAGS.split(','),
			// fix https://github.com/johnsoncodehk/volar/issues/1340
			'hgroup',
			'slot',
			'component',
		])],
		dataAttributes: vueOptions.dataAttributes ?? [],
		htmlAttributes: vueOptions.htmlAttributes ?? ['aria-*'],
		optionsWrapper: vueOptions.optionsWrapper ?? (
			target >= 2.7
				? [`(await import('${lib}')).defineComponent(`, `)`]
				: [`(await import('vue')).default.extend(`, `)`]
		),
		macros: {
			defineProps: ['defineProps'],
			defineSlots: ['defineSlots'],
			defineEmits: ['defineEmits'],
			defineExpose: ['defineExpose'],
			defineModel: ['defineModel'],
			defineOptions: ['defineOptions'],
			withDefaults: ['withDefaults'],
			...vueOptions.macros,
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

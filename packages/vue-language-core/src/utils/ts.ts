import type * as ts from 'typescript/lib/tsserverlibrary';
import * as path from 'path';
import type { VueCompilerOptions, VueLanguagePlugin } from '../types';

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
		vueOptions = {
			...vueOptions,
			...getVueCompilerOptions(ts, ts.readJsonConfigFile(extendPath, proxyHost.host.readFile)),
		};
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
			vueOptions = {
				...vueOptions,
				...getVueCompilerOptions(ts, ts.readJsonConfigFile(extendPath, proxyHost.host.readFile)),
			};
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
	const extendConfigPaths = new Set<string>();
	const host = new Proxy(parseConfigHost, {
		get(target, key) {
			if (key === 'readFile') {
				return (fileName: string) => {
					if (!fileName.endsWith('/package.json')) {
						extendConfigPaths.add(fileName);
					}
					return target.readFile(fileName);
				};
			}
			return target[key as keyof typeof target];
		}
	});
	return {
		host,
		get extendConfigPaths() {
			return [...extendConfigPaths];
		},
	};
}

function getVueCompilerOptions(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	tsConfigSourceFile: ts.TsConfigSourceFile,
): Partial<VueCompilerOptions> {

	const folder = path.dirname(tsConfigSourceFile.fileName);
	const obj = ts.convertToObject(tsConfigSourceFile, []);
	const vueOptions: Partial<VueCompilerOptions> = obj?.vueCompilerOptions ?? {};

	if (vueOptions.plugins) {
		const pluginPaths = vueOptions.plugins as unknown as string[];
		const plugins = pluginPaths
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

		vueOptions.plugins = plugins;
	}
	vueOptions.hooks = vueOptions.hooks
		?.map(resolvePath)
		.filter((hook): hook is NonNullable<typeof hook> => !!hook);
	vueOptions.experimentalAdditionalLanguageModules = vueOptions.experimentalAdditionalLanguageModules
		?.map(resolvePath)
		.filter((module): module is NonNullable<typeof module> => !!module);

	return vueOptions;

	function resolvePath(scriptPath: string): string | undefined {
		try {
			if (require?.resolve) {
				return require.resolve(scriptPath, { paths: [folder] });
			}
			else {
				console.log('failed to resolve path:', scriptPath, 'require.resolve is not supported in web');
			}
		}
		catch (error) {
			console.warn(error);
		}
		return;
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
	const target = vueOptions.target ?? 3;
	return {
		...vueOptions,

		target,
		extensions: vueOptions.extensions ?? ['.vue'],
		jsxTemplates: vueOptions.jsxTemplates ?? false,
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
				? [`(await import('vue')).defineComponent(`, `)`]
				: [`(await import('vue')).default.extend(`, `)`]
		),
		macros: vueOptions.macros ?? {
			defineProps: ['defineProps'],
			defineEmits: ['defineEmits'],
			defineExpose: ['defineExpose'],
			withDefaults: ['withDefaults'],
		},
		narrowingTypesInInlineHandlers: vueOptions.narrowingTypesInInlineHandlers ?? false,
		plugins: vueOptions.plugins ?? [],
		hooks: vueOptions.hooks ?? [],

		// experimental
		experimentalAdditionalLanguageModules: vueOptions.experimentalAdditionalLanguageModules ?? [],
		experimentalResolveStyleCssClasses: vueOptions.experimentalResolveStyleCssClasses ?? 'scoped',
		experimentalRfc436: vueOptions.experimentalRfc436 ?? false,
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

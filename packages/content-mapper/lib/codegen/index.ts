import { getScriptLang, type IR, type ScriptAnalysis, type TypeScript, type VueSource } from '@vue/language-core';
import { BindingFlag } from '@vue/language-core/lib/script/scriptBindings';
import { computed } from 'alien-signals';
import { type BuiltinPluginFactory, mergeSlots } from './filePlugin';
import { type CodegenPlugin, createFilePlugin, rewriteScripts } from './plugin';
import { createDollarsPlugin } from './plugins/dollars';
import { createInheritedAttrsPlugin } from './plugins/inheritedAttrs';
import { createRefsPlugin } from './plugins/refs';
import { createRootElPlugin } from './plugins/rootEl';
import { createSlotsPlugin } from './plugins/slots';
import { generateScript } from './script';
import { createStylePlugin } from './style';
import { generateTemplate } from './template';
import type { TsCode } from './tsCode';

/** The generated TypeScript / JavaScript code of a Vue file, and the language TypeScript should see it as. */
export interface ServiceScript {
	lang: 'js' | 'jsx' | 'ts' | 'tsx';
	codes: TsCode[];
}

/** The built-in codegen plugins, in the order that their code takes in each slot, before the other plugins. */
const builtinPlugins: readonly BuiltinPluginFactory[] = [
	createSlotsPlugin,
	createInheritedAttrsPlugin,
	createRefsPlugin,
	createRootElPlugin,
	createDollarsPlugin,
	createStylePlugin,
];

export function generateServiceScript(
	ts: TypeScript,
	fileName: string,
	ir: IR,
	analysis: ScriptAnalysis,
	plugins: readonly CodegenPlugin[] = [],
): ServiceScript {
	return useCodegen(ts, fileName, ir, analysis, plugins)();
}

/**
 * The code generation of a Vue file as a graph of computed sections over its IR and script analysis, so that a
 * change of the source regenerates only the sections that read it.
 */
export function useServiceScript(
	ts: TypeScript,
	source: VueSource,
	plugins: readonly CodegenPlugin[],
): () => ServiceScript {
	return useCodegen(ts, source.fileName, source.ir, source.analysis, plugins);
}

function useCodegen(
	ts: TypeScript,
	fileName: string,
	ir: IR,
	analysis: ScriptAnalysis,
	plugins: readonly CodegenPlugin[],
): () => ServiceScript {
	const {
		getResolvedOptions,
		getScriptRanges,
		getScriptSetupRanges,
		getBindingFlags,
		getSetupBindings,
		getSetupConsts,
		getSetupRefs,
		getLocalComponents,
		getLocalDirectives,
		getOptionDirectives,
		getTemplateScope,
		getScopeBindings,
		getDotValueBindings,
		getIsVapor,
		getScriptSetupBindingNames,
		getInheritAttrs,
		getComponentName,
	} = analysis;

	const getTemplateVars = () => getGeneratedTemplate()?.vars;
	const getTemplateTypes = computed((): ReadonlySet<string> =>
		new Set([...getGeneratedTemplate()?.generatedTypes ?? [], ...slots.templateTypes()])
	);
	const filePlugins = [
		...builtinPlugins.map(create => create({ ts, fileName, ir, analysis, getTemplateVars, getTemplateTypes })),
		...plugins.map(plugin => createFilePlugin(plugin, { ts, fileName, ir, analysis })),
	];
	const slots = mergeSlots(filePlugins);

	const hasDefineSlots = computed(() => !!getScriptSetupRanges()?.defineSlots);

	const getSetupPropsAssignName = computed(() => getScriptSetupRanges()?.defineProps?.name);

	const getSetupSlotsAssignName = computed(() => getScriptSetupRanges()?.defineSlots?.name);

	const getGeneratedTemplate = computed(() => {
		if (!ir.template) {
			return;
		}
		const dotValueBindings = getDotValueBindings();
		return generateTemplate({
			typescript: ts,
			vueCompilerOptions: getResolvedOptions(),
			template: ir.template,
			isVapor: getIsVapor(),
			scriptLang: getScriptLang(ir),
			componentName: getComponentName(),
			setupRefs: getSetupRefs(),
			setupConsts: getSetupConsts(),
			setupBindings: getSetupBindings(),
			localDirectives: getLocalDirectives(),
			optionDirectives: getOptionDirectives().keys,
			dotValueBindings,
			reassertBindings: new Set(
				[...dotValueBindings].filter(name => (getBindingFlags().get(name) ?? 0) & BindingFlag.Variable),
			),
			hasDefineSlots: hasDefineSlots(),
			propsAssignName: getSetupPropsAssignName(),
			slotsAssignName: getSetupSlotsAssignName(),
			inheritAttrs: getInheritAttrs(),
			templateScope: getTemplateScope(),
			slots: { elementEnd: slots.elementEnd(), renamedElsewhere: slots.renamedElsewhere() },
		});
	});

	const getGeneratedScript = computed(() => {
		return generateScript({
			vueCompilerOptions: getResolvedOptions(),
			fileName,
			script: ir.script,
			scriptSetup: ir.scriptSetup,
			scriptLang: getScriptLang(ir),
			setupBindings: getScriptSetupBindingNames(),
			localComponents: getLocalComponents(),
			localDirectives: getLocalDirectives(),
			unlistedOptionDirectives: getOptionDirectives().unlisted,
			dotValueBindings: getDotValueBindings(),
			scopeBindings: getScopeBindings(),
			scriptRanges: getScriptRanges(),
			scriptSetupRanges: getScriptSetupRanges(),
			templateTypes: new Set(getTemplateTypes()),
			templateCodes: getGeneratedTemplate()?.codes ?? [],
			templateScopeEnd: getGeneratedTemplate()?.scopeEnd ?? [],
			slots: {
				declarations: slots.declarations(),
				elements: slots.elements(),
				exports: slots.exports(),
				templateContext: slots.templateContext(),
				templateBody: slots.templateBody(),
				templateEnd: slots.templateEnd(),
				templateExports: slots.templateExports(),
				templateExportValues: slots.templateExportValues(),
				componentOptions: slots.componentOptions(),
				fallthroughProps: slots.fallthroughProps(),
				props: slots.props(),
				emits: slots.emits(),
				expose: slots.expose(),
				exposedInstanceTypes: slots.exposedInstanceTypes(),
			},
			rewriteScripts: rewrites => rewriteScripts(filePlugins, ir, rewrites),
		});
	});

	return computed(() => ({
		lang: getScriptLang(ir) as ServiceScript['lang'],
		codes: getGeneratedScript().codes,
	}));
}

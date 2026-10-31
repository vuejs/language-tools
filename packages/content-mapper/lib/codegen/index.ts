import { getScriptLang, type IR, type ScriptAnalysis, type TypeScript, type VueSource } from '@vue/language-core';
import { BindingFlag } from '@vue/language-core/lib/script/scriptBindings';
import { computed } from 'alien-signals';
import { type FilePlugin, mergeSlots } from './filePlugin';
import { createPluginNames, names } from './names';
import {
	type CodegenPlugin,
	recordEdits,
	rewriteScripts,
	type VueCodegenFile,
	type VueCodegenTemplate,
} from './plugin';
import { createInheritedAttrsPlugin } from './plugins/inheritedAttrs';
import { createRefsPlugin } from './plugins/refs';
import { createRootElPlugin } from './plugins/rootEl';
import { createSlotsPlugin } from './plugins/slots';
import { generateScript } from './script';
import { createStylePlugin } from './style';
import { generateTemplate } from './template';
import type { TsPiece } from './tsCode';

/** The generated TypeScript / JavaScript code of a Vue file, and the language TypeScript should see it as. */
export interface ServiceScript {
	lang: 'js' | 'jsx' | 'ts' | 'tsx';
	codes: TsPiece[];
}

/** The built-in codegen plugins, in the order that their code takes in each slot, before the other plugins. */
export const builtinPlugins: readonly CodegenPlugin[] = [
	{ name: 'vue:slots', create: createSlotsPlugin },
	{ name: 'vue:inherited-attrs', create: createInheritedAttrsPlugin },
	{ name: 'vue:refs', create: createRefsPlugin },
	{ name: 'vue:root-el', create: createRootElPlugin },
	{ name: 'vue:style', create: createStylePlugin },
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
	const template: VueCodegenTemplate = {
		instanceType(node) {
			const instance = getTemplateVars()?.componentInstanceVars.get(node);
			return instance && `typeof ${instance.hoistedVar ?? instance.instanceVar}`;
		},
		elementType: tag => `${names.Elements}['${tag}']`,
		slotOutletTypes(node) {
			const outlet = getTemplateVars()?.slotVars.get(node);
			return outlet && {
				props: `typeof ${outlet.propsVar}`,
				name: outlet.expVar && `NonNullable<typeof ${outlet.expVar}>`,
			};
		},
		fallthroughAttrsType() {
			const attrVars = [...getTemplateVars()?.inheritedAttrVars ?? []];
			return attrVars.length ? attrVars.map(name => `typeof ${name}`).join(` & `) : undefined;
		},
	};
	// each snapshot creates the plugins of the file in order, so that they take the same names
	const getFilePlugins = computed(() => {
		const pluginNames = createPluginNames();
		let naming = true;
		const filePlugins = [...builtinPlugins, ...plugins].map(({ name, create }): FilePlugin => {
			const nameOf = pluginNames(name);
			const names = new Set<string>();
			const file: VueCodegenFile = {
				ts,
				fileName,
				ir,
				analysis,
				template,
				name(hint) {
					if (!naming) {
						throw new TypeError(`The codegen plugin '${name}' named ${JSON.stringify(hint)} after its codegen.`);
					}
					const pluginName = nameOf(hint);
					names.add(pluginName);
					return pluginName;
				},
			};
			const plugin = create(file, names);
			const getEdits = computed(() => recordEdits(name, ir, plugin.rewrite?.bind(plugin)));
			return { ...plugin, name, getEdits };
		});
		naming = false;
		return filePlugins;
	});
	const slots = mergeSlots(getFilePlugins, ir);

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
			inheritAttrs: getInheritAttrs(),
			templateScope: getTemplateScope(),
			slots: { elementEnd: slots.elementEnd(), declaredSlots: slots.declaredSlots() },
		});
	});

	const getGeneratedScript = computed(() => {
		return generateScript({
			vueCompilerOptions: getResolvedOptions(),
			ir,
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
			templateGeneratedTypes: getGeneratedTemplate()?.generatedTypes ?? new Set(),
			templateCodes: getGeneratedTemplate()?.codes ?? [],
			templateScopeEnd: getGeneratedTemplate()?.scopeEnd ?? [],
			dollarVars: getGeneratedTemplate() ? getTemplateScope().dollarVars : new Set(),
			slots: {
				declarations: slots.declarations(),
				elements: slots.elements(),
				exports: slots.exports(),
				templateContext: slots.templateContext(),
				templateBody: slots.templateBody(),
				templateTypes: slots.templateTypes(),
				templateDollars: slots.templateDollars(),
				componentOptions: slots.componentOptions(),
				fallthroughProps: slots.fallthroughProps(),
				props: slots.props(),
				emits: slots.emits(),
				expose: slots.expose(),
				generic: slots.generic(),
				componentSlots: slots.componentSlots(),
				exposedInstanceTypes: slots.exposedInstanceTypes(),
			},
			rewriteScripts: rewrites => rewriteScripts(getFilePlugins(), rewrites),
		});
	});

	return computed(() => ({
		lang: getScriptLang(ir) as ServiceScript['lang'],
		codes: getGeneratedScript().codes,
	}));
}

import { getScriptLang, type IR, type ScriptAnalysis, type TypeScript, type VueSource } from '@vue/language-core';
import { BindingFlag } from '@vue/language-core/lib/script/scriptBindings';
import { computed } from 'alien-signals';
import { type CodegenPlugin, getContributions } from './plugin';
import { generateScript } from './script';
import { generateStyle } from './style';
import { generateTemplate } from './template';
import type { TsCode } from './tsCode';

/** The generated TypeScript / JavaScript code of a Vue file, and the language TypeScript should see it as. */
export interface ServiceScript {
	lang: 'js' | 'jsx' | 'ts' | 'tsx';
	codes: TsCode[];
}

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

	const getCodegenContributions = computed(() => getContributions(plugins, { ts, fileName, ir, analysis }));

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
		});
	});

	const getGeneratedStyle = computed(() => {
		if (!ir.styles.length) {
			return;
		}
		return generateStyle({
			typescript: ts,
			vueCompilerOptions: getResolvedOptions(),
			styles: ir.styles,
			scriptLang: getScriptLang(ir),
			setupRefs: getSetupRefs(),
			setupConsts: getSetupConsts(),
			setupBindings: getSetupBindings(),
			dotValueBindings: getDotValueBindings(),
			templateScope: getTemplateScope(),
		});
	});

	const getGeneratedScript = computed(() => {
		return generateScript({
			vueCompilerOptions: getResolvedOptions(),
			fileName,
			script: ir.script,
			scriptSetup: ir.scriptSetup,
			styles: ir.styles,
			scriptLang: getScriptLang(ir),
			setupBindings: getScriptSetupBindingNames(),
			localComponents: getLocalComponents(),
			localDirectives: getLocalDirectives(),
			unlistedOptionDirectives: getOptionDirectives().unlisted,
			dotValueBindings: getDotValueBindings(),
			scopeBindings: getScopeBindings(),
			scriptRanges: getScriptRanges(),
			scriptSetupRanges: getScriptSetupRanges(),
			templateAndStyleTypes: new Set([
				...getGeneratedTemplate()?.generatedTypes ?? [],
				...getGeneratedStyle()?.generatedTypes ?? [],
			]),
			templateAndStyleCodes: [
				...getGeneratedStyle()?.bindingReferences ?? [],
				...getGeneratedTemplate()?.bindingReferences ?? [],
				...getGeneratedStyle()?.codes ?? [],
				...getGeneratedTemplate()?.codes ?? [],
			],
			scriptEdits: getCodegenContributions().scriptEdits,
			templateContext: getCodegenContributions().templateContext,
			props: getCodegenContributions().props,
			emits: getCodegenContributions().emits,
			expose: getCodegenContributions().expose,
			elements: getCodegenContributions().elements,
			declarations: getCodegenContributions().declarations,
			exports: getCodegenContributions().exports,
		});
	});

	return computed(() => ({
		lang: getScriptLang(ir) as ServiceScript['lang'],
		codes: getGeneratedScript().codes,
	}));
}

import { forEachEmbeddedCode, type VirtualCode } from '@volar/language-core';
import {
	getScriptAnalysis,
	getScriptLang,
	type IR,
	type TypeScript,
	type VueCompilerOptions,
	type VueLanguagePlugin,
} from '@vue/language-core';
import { BindingFlag } from '@vue/language-core/lib/parsers/utils';
import { computed } from 'alien-signals';
import { generateScript } from './codegen/script';
import { generateStyle } from './codegen/style';
import { generateTemplate } from './codegen/template';

export const serviceScriptRE = /^script_(?:js|jsx|ts|tsx)$/;
export const tsCodegen = new WeakMap<IR, ReturnType<typeof useCodegen>>();

const plugin: VueLanguagePlugin = ({
	modules: { typescript: ts },
	vueCompilerOptions,
}) => {
	return {
		version: 4,
		name: 'vue-tsx',

		getEmbeddedCodes(_fileName, ir) {
			const lang = getScriptLang(ir);
			return [{ lang, id: 'script_' + lang }];
		},

		resolveEmbeddedCode(fileName, ir, embeddedFile) {
			if (serviceScriptRE.test(embeddedFile.id)) {
				let codegen = tsCodegen.get(ir);
				if (!codegen) {
					tsCodegen.set(ir, codegen = useCodegen(ts, vueCompilerOptions, fileName, ir));
				}
				const generatedScript = codegen.getGeneratedScript();
				embeddedFile.content = [...generatedScript.codes];
			}
		},
	};
};

export default plugin;

/** The generated TypeScript / JavaScript code of a Vue file, and the extension TypeScript should see it with. */
export function getServiceScript(root: VirtualCode) {
	for (const code of forEachEmbeddedCode(root)) {
		if (serviceScriptRE.test(code.id)) {
			return {
				code,
				extension: '.' + code.id.slice('script_'.length) as '.js' | '.jsx' | '.ts' | '.tsx',
			};
		}
	}
}

function useCodegen(
	ts: TypeScript,
	vueCompilerOptions: VueCompilerOptions,
	fileName: string,
	ir: IR,
) {
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
		getTemplateScope,
		getScopeBindings,
		getDotValueBindings,
		getIsVapor,
		getScriptSetupBindingNames,
		getInheritAttrs,
		getComponentName,
	} = getScriptAnalysis(ts, vueCompilerOptions, fileName, ir);

	const hasDefineSlots = computed(() => !!getScriptSetupRanges()?.defineSlots);

	const getSetupPropsAssignName = computed(() => getScriptSetupRanges()?.defineProps?.name);

	const getSetupSlotsAssignName = computed(() => getScriptSetupRanges()?.defineSlots?.name);

	const getGeneratedTemplate = computed(() => {
		if (getResolvedOptions().skipTemplateCodegen || !ir.template) {
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
			dotValueBindings: getDotValueBindings(),
			scopeBindings: getScopeBindings(),
			scriptRanges: getScriptRanges(),
			scriptSetupRanges: getScriptSetupRanges(),
			templateAndStyleTypes: new Set([
				...getGeneratedTemplate()?.generatedTypes ?? [],
				...getGeneratedStyle()?.generatedTypes ?? [],
			]),
			templateAndStyleCodes: [
				...getGeneratedStyle()?.codes ?? [],
				...getGeneratedTemplate()?.codes ?? [],
			],
		});
	});

	return {
		getScriptRanges,
		getScriptSetupRanges,
		getGeneratedScript,
		getGeneratedTemplate,
		getSetupBindings,
		getLocalComponents,
	};
}

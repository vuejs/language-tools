import { forEachEmbeddedCode, type VirtualCode } from '@volar/language-core';
import {
	getBaseNameWithoutExtension,
	getScriptAnalysis,
	getScriptLang,
	type IR,
	type TypeScript,
	type VueCompilerOptions,
	type VueLanguagePlugin,
} from '@vue/language-core';
import { BindingFlag } from '@vue/language-core/lib/parsers/utils';
import { computedSet } from '@vue/language-core/lib/utils/signals';
import { camelize, capitalize } from '@vue/shared';
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
		getLocalComponents,
	} = getScriptAnalysis(ts, vueCompilerOptions, fileName, ir);

	const getIsVapor = computed(() =>
		getResolvedOptions().vapor || !!(ir.scriptSetup?.attrs.vapor || ir.template?.attrs.vapor)
	);

	const getScriptSetupBindings = computedSet(() => new Set(getScriptSetupRanges()?.bindings.keys()));

	const getSetupConsts = computedSet(() => {
		const names = new Set<string>();
		for (const [name, flags] of getBindingFlags()) {
			if (flags & BindingFlag.Const) {
				names.add(name);
			}
		}
		const { defineProps } = getScriptSetupRanges() ?? {};
		if (defineProps?.destructured) {
			for (const name of defineProps.destructured.keys()) {
				names.add(name);
			}
			if (defineProps.destructuredRest) {
				names.add(defineProps.destructuredRest);
			}
		}
		return names;
	});

	const getSetupRefs = computedSet(() => {
		return new Set(
			getScriptSetupRanges()?.useTemplateRef
				.map(({ name }) => name)
				.filter(name => name !== undefined),
		);
	});

	const hasDefineSlots = computed(() => !!getScriptSetupRanges()?.defineSlots);

	const getSetupPropsAssignName = computed(() => getScriptSetupRanges()?.defineProps?.name);

	const getSetupSlotsAssignName = computed(() => getScriptSetupRanges()?.defineSlots?.name);

	const getInheritAttrs = computed(() => {
		const value = getScriptSetupRanges()?.defineOptions?.inheritAttrs
			?? getScriptRanges()?.exportDefault?.options?.inheritAttrs;
		return value !== 'false';
	});

	const getComponentName = computed(() => {
		let name: string;
		const componentOptions = getScriptRanges()?.exportDefault?.options;
		if (ir.script && componentOptions?.name) {
			name = ir.script.content.slice(
				componentOptions.name.start + 1,
				componentOptions.name.end - 1,
			);
		}
		else {
			const { defineOptions } = getScriptSetupRanges() ?? {};
			if (ir.scriptSetup && defineOptions?.name) {
				name = defineOptions.name;
			}
			else {
				name = getBaseNameWithoutExtension(fileName);
			}
		}
		return capitalize(camelize(name));
	});

	const generateTemplatePass = (dotValueBindings: Set<string>) => {
		if (getResolvedOptions().skipTemplateCodegen || !ir.template) {
			return;
		}
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
		});
	};

	const generateStylePass = (dotValueBindings: Set<string>) => {
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
			dotValueBindings,
		});
	};

	const getLocalDirectives = computedSet(() => {
		const bindings = getSetupBindings();
		if (!bindings.size) {
			return bindings;
		}
		// `v[A-Z]` is a naming heuristic: without type analysis there is no
		// reliable signal to tell a directive from a same-named value binding.
		// This feeds the local-directive type / completion, where false positives
		// are harmless (they only surface as extra completion candidates).
		return new Set([...bindings].filter(name => /^v[A-Z]/.test(name)));
	});

	// First pass: collect bindings used in narrowing positions (output discarded);
	// the second pass (the computeds below) finalizes every access of these with `.value`.
	const getDotValueBindings = computedSet(() => {
		const bindings = getSetupBindings();
		if (!bindings.size) {
			return bindings;
		}
		const names: string[] = [];
		for (const generated of [generateTemplatePass(new Set()), generateStylePass(new Set())]) {
			names.push(...generated?.dotValueAccesses ?? []);
		}
		return new Set(names);
	});

	const getGeneratedTemplate = computed(() => generateTemplatePass(getDotValueBindings()));
	const getGeneratedStyle = computed(() => generateStylePass(getDotValueBindings()));

	const getReferencedBindings = computedSet(() => {
		const bindings = getSetupBindings();
		if (!bindings.size) {
			return bindings;
		}
		return new Set([
			...getGeneratedTemplate()?.contextAccesses.keys() ?? [],
			...getGeneratedStyle()?.contextAccesses.keys() ?? [],
		].filter(name => bindings.has(name)));
	});

	const getScopeBindings = computedSet(() => {
		const bindings = getSetupBindings();
		const consts = getSetupConsts();
		return new Set([
			...getGeneratedTemplate()?.scopeMemberNames ?? [],
			...getGeneratedStyle()?.scopeMemberNames ?? [],
		].filter(name => bindings.has(name) || consts.has(name)));
	});

	const getUsedSetupBindings = computedSet(() => {
		return new Set([
			...getReferencedBindings(),
			...getLocalComponents(),
		]);
	});

	const getGeneratedScript = computed(() => {
		return generateScript({
			vueCompilerOptions: getResolvedOptions(),
			fileName,
			script: ir.script,
			scriptSetup: ir.scriptSetup,
			styles: ir.styles,
			scriptLang: getScriptLang(ir),
			setupBindings: getScriptSetupBindings(),
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
		getScopeBindings,
		getLocalComponents,
		getUsedSetupBindings,
	};
}

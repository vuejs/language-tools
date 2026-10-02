import { camelize, capitalize } from '@vue/shared';
import { computed } from 'alien-signals';
import * as path from 'path-browserify';
import { generateScript } from '../codegen/script';
import { generateStyle } from '../codegen/style';
import { generateTemplate } from '../codegen/template';
import { CompilerOptionsResolver } from '../compilerOptions';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { BindingFlag } from '../parsers/utils';
import { parseVueCompilerOptions } from '../parsers/vueCompilerOptions';
import type { IR, VueCompilerOptions, VueLanguagePlugin } from '../types';
import { computedSet } from '../utils/signals';

export const serviceScriptRE = /^script_(?:js|jsx|ts|tsx)$/;
export const tsCodegen = new WeakMap<IR, ReturnType<typeof useCodegen>>();

const validLangs = new Set(['js', 'jsx', 'ts', 'tsx']);

const plugin: VueLanguagePlugin = ({
	modules: { typescript: ts },
	vueCompilerOptions,
}) => {
	return {
		version: 2.2,

		getEmbeddedCodes(_fileName, ir) {
			const lang = computeLang(ir);
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

function computeLang(ir: IR) {
	let lang = ir.scriptSetup?.lang ?? ir.script?.lang;
	if (ir.script && ir.scriptSetup) {
		if (ir.scriptSetup.lang !== 'js') {
			lang = ir.scriptSetup.lang;
		}
		else {
			lang = ir.script.lang;
		}
	}
	if (lang && validLangs.has(lang)) {
		return lang;
	}
	return 'ts';
}

export default plugin;

function useCodegen(
	ts: typeof import('typescript'),
	vueCompilerOptions: VueCompilerOptions,
	fileName: string,
	ir: IR,
) {
	const getResolvedOptions = computed(() => {
		const options = parseVueCompilerOptions(ir.comments);
		if (options) {
			const resolver = new CompilerOptionsResolver(ts, () => undefined /* does not support resolving target="auto" */);
			resolver.addConfig(options, path.dirname(fileName));
			return resolver.build(vueCompilerOptions);
		}
		return vueCompilerOptions;
	});

	const getIsVapor = computed(() =>
		getResolvedOptions().vapor || !!(ir.scriptSetup?.attrs.vapor || ir.template?.attrs.vapor)
	);

	const getScriptRanges = computed(() =>
		ir.script && validLangs.has(ir.script.lang)
			? parseScriptRanges(ts, ir.script.ast, getResolvedOptions())
			: undefined
	);

	const getScriptSetupRanges = computed(() =>
		ir.scriptSetup && validLangs.has(ir.scriptSetup.lang)
			? parseScriptSetupRanges(ts, ir.scriptSetup.ast, getResolvedOptions())
			: undefined
	);

	const getBindingFlags = computed(() => {
		const flags = new Map<string, BindingFlag>(getScriptSetupRanges()?.bindings);
		const scriptRanges = getScriptRanges();
		if (ir.scriptSetup && scriptRanges) {
			for (const [name, flag] of scriptRanges.bindings) {
				if (!flags.has(name)) {
					flags.set(name, flag);
				}
			}
		}
		return flags;
	});

	const getImportedComponents = computedSet(() => {
		const names = new Set<string>();
		for (const [name, flags] of getBindingFlags()) {
			if (flags & BindingFlag.Component) {
				names.add(name);
			}
		}
		return names;
	});

	const getSetupBindings = computedSet(() => new Set(getBindingFlags().keys()));

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
				const baseName = path.basename(fileName);
				name = baseName.slice(0, baseName.lastIndexOf('.'));
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
			scriptLang: computeLang(ir),
			componentName: getComponentName(),
			importedComponents: getImportedComponents(),
			setupRefs: getSetupRefs(),
			setupConsts: getSetupConsts(),
			setupBindings: getSetupBindings(),
			dotValueBindings,
			reassertBindings: new Set(
				[...dotValueBindings].filter(name => (getBindingFlags().get(name) ?? 0) & BindingFlag.Variable),
			),
			importBindings: new Set(
				[...dotValueBindings].filter(name => (getBindingFlags().get(name) ?? 0) & BindingFlag.Import),
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
			scriptLang: computeLang(ir),
			setupRefs: getSetupRefs(),
			setupConsts: getSetupConsts(),
			setupBindings: getSetupBindings(),
			dotValueBindings,
		});
	};

	const getLocalComponents = computedSet(() => {
		const bindings = getSetupBindings();
		if (!bindings.size) {
			return bindings;
		}
		return new Set(
			ir.template?.ast?.components
				.flatMap(name => [camelize(name), capitalize(camelize(name))])
				.filter(name => bindings.has(name)),
		);
	});

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
			scriptLang: computeLang(ir),
			setupBindings: getScriptSetupBindings(),
			localComponents: getLocalComponents(),
			localDirectives: getLocalDirectives(),
			dotValueBindings: getDotValueBindings(),
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
		getImportedComponents,
		getSetupBindings,
		getLocalComponents,
		getUsedSetupBindings,
	};
}

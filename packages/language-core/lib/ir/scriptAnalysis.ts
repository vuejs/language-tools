import { camelize, capitalize } from '@vue/shared';
import { computed } from 'alien-signals';
import * as path from 'path-browserify';
import { getBaseNameWithoutExtension } from '../names';
import { parseVueCompilerOptions } from '../options/commentOptions';
import { CompilerOptionsResolver } from '../options/compilerOptions';
import { BindingFlag } from '../script/scriptBindings';
import { parseScriptRanges } from '../script/scriptRanges';
import { parseScriptSetupRanges } from '../script/scriptSetupRanges';
import { collectTemplateScope, type InlayHintInfo } from '../template/templateScope';
import type { IR, TypeScript, VueCompilerOptions } from '../types';
import { computedSet } from './signals';

const validLangs = new Set(['js', 'jsx', 'ts', 'tsx']);

export type ScriptAnalysis = ReturnType<typeof createScriptAnalysis>;

/** The language of a Vue file's script blocks together: `js`, `jsx`, `ts` or `tsx`. */
export function getScriptLang(ir: IR) {
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

/**
 * What the script blocks of a Vue file declare, read from their syntax trees at the offsets of the blocks, without
 * generating code. Owned by the `VueSource` of the IR, and shared by the code generation and the language service.
 */
export function createScriptAnalysis(
	ts: TypeScript,
	vueCompilerOptions: VueCompilerOptions,
	fileName: string,
	ir: IR,
) {
	const getResolvedOptions = computed(() => {
		const options = parseVueCompilerOptions(ir.comments);
		if (options) {
			const resolver = new CompilerOptionsResolver(() => undefined /* does not support resolving target="auto" */);
			resolver.addConfig(options, path.dirname(fileName));
			return resolver.build(vueCompilerOptions);
		}
		return vueCompilerOptions;
	});

	const getScriptRanges = computed(() =>
		ir.script && validLangs.has(ir.script.lang)
			? parseScriptRanges(ts, ir.script.ast)
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

	const getSetupBindings = computedSet(() => new Set(getBindingFlags().keys()));

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

	const getIsVapor = computed(() =>
		getResolvedOptions().vapor || !!(ir.scriptSetup?.attrs.vapor || ir.template?.attrs.vapor)
	);

	/** The names that `<script setup>` alone declares, without the ones of `<script>`. */
	const getScriptSetupBindingNames = computedSet(() => new Set(getScriptSetupRanges()?.bindings.keys()));

	const getInheritAttrs = computed(() => {
		const value = getScriptSetupRanges()?.defineOptions?.inheritAttrs
			?? getScriptRanges()?.exportDefault?.options?.inheritAttrs;
		return value !== 'false';
	});

	/** The name of the component: its `name` option, its `defineOptions` name, or the name of the file. */
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

	const getTemplateScope = computed(() => {
		const scriptSetupRanges = getScriptSetupRanges();
		return collectTemplateScope(ts, ir, {
			vueCompilerOptions: getResolvedOptions(),
			isVapor: getIsVapor(),
			setupBindings: getSetupBindings(),
			setupConsts: getSetupConsts(),
			setupRefs: getSetupRefs(),
			hasDefineSlots: !!scriptSetupRanges?.defineSlots,
			propsAssignName: scriptSetupRanges?.defineProps?.name,
			slotsAssignName: scriptSetupRanges?.defineSlots?.name,
		});
	});

	/** The setup bindings and consts that the template scope lists, as the template and the styles reference them. */
	const getScopeBindings = computedSet(() => {
		const bindings = getSetupBindings();
		const consts = getSetupConsts();
		const { templateNames, styleNames } = getTemplateScope();
		return new Set([...templateNames, ...styleNames].filter(name => bindings.has(name) || consts.has(name)));
	});

	/**
	 * The setup bindings that the template or the styles narrow or query the type of at least once: the code
	 * generation reads their `.value` at every reference, so that the narrowing applies to the same reference chain.
	 */
	const getDotValueBindings = computedSet(() => getTemplateScope().dotValueBindings);

	const getInlayHints = computed(() => {
		const hints: InlayHintInfo[] = [...getTemplateScope().inlayHints];
		const { script } = ir;
		const exportDefault = getScriptRanges()?.exportDefault;
		const { optionsWrapper } = getResolvedOptions();
		if (script && typeof script.src !== 'object' && exportDefault) {
			const { expression, isObjectLiteral } = exportDefault.options ?? exportDefault;
			if (isObjectLiteral && optionsWrapper.length) {
				const [wrapLeft, wrapRight] = optionsWrapper;
				hints.push({
					blockName: script.name,
					offset: expression.start,
					setting: 'vue.inlayHints.optionsWrapper',
					label: wrapLeft || '[Missing optionsWrapper[0]]',
					tooltip: [
						'This is virtual code that is automatically wrapped for type support, it does not affect your runtime behavior, you can customize it via `vueCompilerOptions.optionsWrapper` option in tsconfig / jsconfig.',
						'To hide it, you can set `"vue.inlayHints.optionsWrapper": false` in IDE settings.',
					].join('\n\n'),
				}, {
					blockName: script.name,
					offset: expression.end,
					setting: 'vue.inlayHints.optionsWrapper',
					label: wrapRight || '[Missing optionsWrapper[1]]',
				});
			}
		}
		return hints;
	});

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

	return {
		getResolvedOptions,
		getScriptRanges,
		getScriptSetupRanges,
		getBindingFlags,
		getSetupBindings,
		getSetupConsts,
		getSetupRefs,
		getIsVapor,
		getScriptSetupBindingNames,
		getInheritAttrs,
		getComponentName,
		getLocalComponents,
		getLocalDirectives,
		getTemplateScope,
		getScopeBindings,
		getDotValueBindings,
		getInlayHints,
	};
}

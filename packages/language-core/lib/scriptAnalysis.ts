import { camelize, capitalize } from '@vue/shared';
import { computed } from 'alien-signals';
import * as path from 'path-browserify';
import { CompilerOptionsResolver } from './compilerOptions';
import { parseScriptRanges } from './parsers/scriptRanges';
import { parseScriptSetupRanges } from './parsers/scriptSetupRanges';
import { BindingFlag } from './parsers/utils';
import { parseVueCompilerOptions } from './parsers/vueCompilerOptions';
import type { IR, TypeScript, VueCompilerOptions } from './types';
import { computedSet } from './utils/signals';

const validLangs = new Set(['js', 'jsx', 'ts', 'tsx']);
const scriptAnalyses = new WeakMap<IR, ReturnType<typeof useScriptAnalysis>>();

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
 * generating code. Computed once per IR and shared by the code generation and the language service.
 */
export function getScriptAnalysis(
	ts: TypeScript,
	vueCompilerOptions: VueCompilerOptions,
	fileName: string,
	ir: IR,
) {
	let analysis = scriptAnalyses.get(ir);
	if (!analysis) {
		scriptAnalyses.set(ir, analysis = useScriptAnalysis(ts, vueCompilerOptions, fileName, ir));
	}
	return analysis;
}

function useScriptAnalysis(
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

	return {
		getResolvedOptions,
		getScriptRanges,
		getScriptSetupRanges,
		getBindingFlags,
		getSetupBindings,
		getSetupConsts,
		getSetupRefs,
		getLocalComponents,
	};
}

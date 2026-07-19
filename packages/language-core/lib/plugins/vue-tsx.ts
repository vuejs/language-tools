import { camelize, capitalize } from '@vue/shared';
import { computed } from 'alien-signals';
import * as path from 'path-browserify';
import { generateScript } from '../codegen/script';
import { generateStyle } from '../codegen/style';
import { generateTemplate } from '../codegen/template';
import { CompilerOptionsResolver } from '../compilerOptions';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
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
};

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

	const getImportedComponents = computedSet(() => {
		const names = new Set<string>();
		const scriptSetupRanges = getScriptSetupRanges();
		if (ir.scriptSetup && scriptSetupRanges) {
			for (const range of scriptSetupRanges.components) {
				names.add(ir.scriptSetup.content.slice(range.start, range.end));
			}
			const scriptRange = getScriptRanges();
			if (ir.script && scriptRange) {
				for (const range of scriptRange.components) {
					names.add(ir.script.content.slice(range.start, range.end));
				}
			}
		}
		return names;
	});

	const getSetupBindings = computedSet(() => {
		const names = new Set<string>();
		const scriptSetupRanges = getScriptSetupRanges();
		if (ir.scriptSetup && scriptSetupRanges) {
			for (const range of scriptSetupRanges.bindings) {
				names.add(ir.scriptSetup.content.slice(range.start, range.end));
			}
			const scriptRanges = getScriptRanges();
			if (ir.script && scriptRanges) {
				for (const range of scriptRanges.bindings) {
					names.add(ir.script.content.slice(range.start, range.end));
				}
			}
		}
		return names;
	});

	const getSetupConsts = computedSet(() => {
		const scriptSetupRanges = getScriptSetupRanges();
		const names = new Set([
			...scriptSetupRanges?.defineProps?.destructured?.keys() ?? [],
			...getImportedComponents(),
		]);
		const rest = scriptSetupRanges?.defineProps?.destructuredRest;
		if (rest) {
			names.add(rest);
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

	const getGeneratedTemplate = computed(() => {
		if (getResolvedOptions().skipTemplateCodegen || !ir.template) {
			return;
		}
		return generateTemplate({
			typescript: ts,
			vueCompilerOptions: getResolvedOptions(),
			template: ir.template,
			componentName: getComponentName(),
			isVapor: !!(ir.scriptSetup?.attrs.vapor || ir.template.attrs.vapor),
			setupConsts: getSetupConsts(),
			setupRefs: getSetupRefs(),
			hasDefineSlots: hasDefineSlots(),
			propsAssignName: getSetupPropsAssignName(),
			slotsAssignName: getSetupSlotsAssignName(),
			inheritAttrs: getInheritAttrs(),
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
			setupConsts: getSetupConsts(),
			setupRefs: getSetupRefs(),
		});
	});

	const getSetupExposed = computedSet(() => {
		const bindings = getSetupBindings();
		if (!bindings.size) {
			return bindings;
		}
		return new Set([
			...getGeneratedTemplate()?.contextAccesses.keys() ?? [],
			...getGeneratedStyle()?.contextAccesses.keys() ?? [],
			...ir.template?.ast?.components.flatMap(name => [camelize(name), capitalize(camelize(name))]) ?? [],
		].filter(name => bindings.has(name)));
	});

	const getGeneratedScript = computed(() => {
		return generateScript({
			vueCompilerOptions: getResolvedOptions(),
			fileName,
			script: ir.script,
			scriptSetup: ir.scriptSetup,
			exposed: getSetupExposed(),
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
		getSetupExposed,
	};
}

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
import type { Sfc, VueCompilerOptions, VueLanguagePlugin } from '../types';
import { computedSet } from '../utils/signals';

export const tsCodegen = new WeakMap<Sfc, ReturnType<typeof useCodegen>>();

const validLangs = new Set(['js', 'jsx', 'ts', 'tsx']);

const plugin: VueLanguagePlugin = ({
	modules: { typescript: ts },
	vueCompilerOptions,
}) => {
	return {
		version: 2.2,

		getEmbeddedCodes(_fileName, sfc) {
			const lang = computeLang(sfc);
			return [{ lang, id: 'script_' + lang }];
		},

		resolveEmbeddedCode(fileName, sfc, embeddedFile) {
			if (/script_(js|jsx|ts|tsx)/.test(embeddedFile.id)) {
				let codegen = tsCodegen.get(sfc);
				if (!codegen) {
					tsCodegen.set(sfc, codegen = useCodegen(ts, vueCompilerOptions, fileName, sfc));
				}
				const generatedScript = codegen.getGeneratedScript();
				embeddedFile.content = [...generatedScript.codes];
			}
		},
	};

	function computeLang(sfc: Sfc) {
		let lang = sfc.scriptSetup?.lang ?? sfc.script?.lang;
		if (sfc.script && sfc.scriptSetup) {
			if (sfc.scriptSetup.lang !== 'js') {
				lang = sfc.scriptSetup.lang;
			}
			else {
				lang = sfc.script.lang;
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
	sfc: Sfc,
) {
	const getResolvedOptions = computed(() => {
		const options = parseVueCompilerOptions(sfc.comments);
		if (options) {
			const resolver = new CompilerOptionsResolver(ts, () => undefined /* does not support resolving target="auto" */);
			resolver.addConfig(options, path.dirname(fileName));
			return resolver.build(vueCompilerOptions);
		}
		return vueCompilerOptions;
	});

	const getScriptRanges = computed(() =>
		sfc.script && validLangs.has(sfc.script.lang)
			? parseScriptRanges(ts, sfc.script.ast, getResolvedOptions())
			: undefined
	);

	const getScriptSetupRanges = computed(() =>
		sfc.scriptSetup && validLangs.has(sfc.scriptSetup.lang)
			? parseScriptSetupRanges(ts, sfc.scriptSetup.ast, getResolvedOptions())
			: undefined
	);

	const getImportedComponents = computedSet(() => {
		const names = new Set<string>();
		const scriptSetupRanges = getScriptSetupRanges();
		if (sfc.scriptSetup && scriptSetupRanges) {
			for (const range of scriptSetupRanges.components) {
				names.add(sfc.scriptSetup.content.slice(range.start, range.end));
			}
			const scriptRange = getScriptRanges();
			if (sfc.script && scriptRange) {
				for (const range of scriptRange.components) {
					names.add(sfc.script.content.slice(range.start, range.end));
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
			?? getScriptRanges()?.exports.default?.options?.inheritAttrs;
		return value !== 'false';
	});

	const getComponentName = computed(() => {
		let name: string;
		const componentOptions = getScriptRanges()?.exports.default?.options;
		if (sfc.script && componentOptions?.name) {
			name = sfc.script.content.slice(
				componentOptions.name.start + 1,
				componentOptions.name.end - 1,
			);
		}
		else {
			const { defineOptions } = getScriptSetupRanges() ?? {};
			if (sfc.scriptSetup && defineOptions?.name) {
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
		if (getResolvedOptions().skipTemplateCodegen || !sfc.template) {
			return;
		}
		return generateTemplate({
			typescript: ts,
			vueCompilerOptions: getResolvedOptions(),
			template: sfc.template,
			componentName: getComponentName(),
			setupConsts: getSetupConsts(),
			setupRefs: getSetupRefs(),
			hasDefineSlots: hasDefineSlots(),
			propsAssignName: getSetupPropsAssignName(),
			slotsAssignName: getSetupSlotsAssignName(),
			inheritAttrs: getInheritAttrs(),
		});
	});

	const getGeneratedStyle = computed(() => {
		if (!sfc.styles.length) {
			return;
		}
		return generateStyle({
			typescript: ts,
			vueCompilerOptions: getResolvedOptions(),
			styles: sfc.styles,
			setupConsts: getSetupConsts(),
			setupRefs: getSetupRefs(),
		});
	});

	const getSetupExposed = computedSet(() => {
		const allVars = new Set<string>();
		const scriptSetupRanges = getScriptSetupRanges();
		if (!sfc.scriptSetup || !scriptSetupRanges) {
			return allVars;
		}
		for (const range of scriptSetupRanges.bindings) {
			const name = sfc.scriptSetup.content.slice(range.start, range.end);
			allVars.add(name);
		}
		const scriptRanges = getScriptRanges();
		if (sfc.script && scriptRanges) {
			for (const range of scriptRanges.bindings) {
				const name = sfc.script.content.slice(range.start, range.end);
				allVars.add(name);
			}
		}
		if (!allVars.size) {
			return allVars;
		}
		const exposedNames = new Set<string>();
		const generatedTemplate = getGeneratedTemplate();
		const generatedStyle = getGeneratedStyle();
		for (const [name] of generatedTemplate?.componentAccessMap ?? []) {
			if (allVars.has(name)) {
				exposedNames.add(name);
			}
		}
		for (const [name] of generatedStyle?.componentAccessMap ?? []) {
			if (allVars.has(name)) {
				exposedNames.add(name);
			}
		}
		for (const component of sfc.template?.ast?.components ?? []) {
			const testNames = new Set([camelize(component), capitalize(camelize(component))]);
			for (const testName of testNames) {
				if (allVars.has(testName)) {
					exposedNames.add(testName);
				}
			}
		}
		return exposedNames;
	});

	const getGeneratedScript = computed(() => {
		return generateScript({
			vueCompilerOptions: getResolvedOptions(),
			fileName,
			script: sfc.script,
			scriptSetup: sfc.scriptSetup,
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
		getSetupExposed,
	};
}

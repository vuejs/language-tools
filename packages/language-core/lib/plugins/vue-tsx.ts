import { camelize, capitalize } from '@vue/shared';
import { computed } from 'alien-signals';
import * as path from 'path-browserify';
import { generateScript } from '../codegen/script';
import { generateStyle } from '../codegen/style';
import { generateTemplate } from '../codegen/template';
import type { TemplateCodegenContext } from '../codegen/template/context';
import { CompilerOptionsResolver } from '../compilerOptions';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { parseVueCompilerOptions } from '../parsers/vueCompilerOptions';
import type { Code, Sfc, VueLanguagePlugin } from '../types';
import { computedArray, computedSet } from '../utils/signals';

export const tsCodegen = new WeakMap<Sfc, ReturnType<typeof useCodegen>>();

const validLangs = new Set(['js', 'jsx', 'ts', 'tsx']);

const plugin: VueLanguagePlugin = ctx => {
	return {
		version: 2.2,

		requiredCompilerOptions: [
			'noPropertyAccessFromIndexSignature',
		],

		getEmbeddedCodes(fileName, sfc) {
			const codegen = getCodegen(fileName, sfc);
			return [{
				id: 'script_' + codegen.getLang(),
				lang: codegen.getLang(),
			}];
		},

		resolveEmbeddedCode(fileName, sfc, embeddedFile) {
			if (/script_(js|jsx|ts|tsx)/.test(embeddedFile.id)) {
				const codegen = getCodegen(fileName, sfc);
				const generatedScript = codegen.getGeneratedScript();
				embeddedFile.content = [...generatedScript.codes];
			}
		},
	};

	function getCodegen(fileName: string, sfc: Sfc) {
		if (!tsCodegen.has(sfc)) {
			tsCodegen.set(sfc, useCodegen(fileName, sfc, ctx));
		}
		return tsCodegen.get(sfc)!;
	}
};

export default plugin;

function useCodegen(
	fileName: string,
	sfc: Sfc,
	ctx: Parameters<VueLanguagePlugin>[0],
) {
	const ts = ctx.modules.typescript;

	const getRawLang = computed(() => {
		if (sfc.script && sfc.scriptSetup) {
			if (sfc.scriptSetup.lang !== 'js') {
				return sfc.scriptSetup.lang;
			}
			else {
				return sfc.script.lang;
			}
		}
		return sfc.scriptSetup?.lang ?? sfc.script?.lang;
	});

	const getLang = computed(() => {
		const rawLang = getRawLang();
		if (rawLang && validLangs.has(rawLang)) {
			return rawLang;
		}
		return 'ts';
	});

	const getResolvedOptions = computed(() => {
		const options = parseVueCompilerOptions(sfc.comments);
		if (options) {
			const resolver = new CompilerOptionsResolver();
			resolver.addConfig(options, path.dirname(fileName));
			return resolver.build(ctx.vueCompilerOptions);
		}
		return ctx.vueCompilerOptions;
	});

	const getScriptRanges = computed(() =>
		sfc.script && validLangs.has(sfc.script.lang)
			? parseScriptRanges(ts, sfc.script.ast, !!sfc.scriptSetup)
			: undefined
	);

	const getScriptSetupRanges = computed(() =>
		sfc.scriptSetup && validLangs.has(sfc.scriptSetup.lang)
			? parseScriptSetupRanges(ts, sfc.scriptSetup.ast, getResolvedOptions())
			: undefined
	);

	const getSetupBindingNames = computedSet(() => {
		const newNames = new Set<string>();
		const scriptSetupRanges = getScriptSetupRanges();
		if (!sfc.scriptSetup || !scriptSetupRanges) {
			return newNames;
		}
		for (const { range } of scriptSetupRanges.bindings) {
			newNames.add(sfc.scriptSetup.content.slice(range.start, range.end));
		}
		const scriptRanges = getScriptRanges();
		if (sfc.script && scriptRanges) {
			for (const { range } of scriptRanges.bindings) {
				newNames.add(sfc.script.content.slice(range.start, range.end));
			}
		}
		return newNames;
	});

	const getSetupImportComponentNames = computedSet(() => {
		const newNames = new Set<string>();
		const bindings = getScriptSetupRanges()?.bindings;
		if (sfc.scriptSetup && bindings) {
			for (const { range, moduleName, isDefaultImport, isNamespace } of bindings) {
				if (
					moduleName
					&& isDefaultImport
					&& !isNamespace
					&& ctx.vueCompilerOptions.extensions.some(ext => moduleName.endsWith(ext))
				) {
					newNames.add(sfc.scriptSetup.content.slice(range.start, range.end));
				}
			}
		}
		return newNames;
	});

	const getDestructuredPropNames = computedSet(() => {
		const newNames = new Set(getScriptSetupRanges()?.defineProps?.destructured?.keys());
		const rest = getScriptSetupRanges()?.defineProps?.destructuredRest;
		if (rest) {
			newNames.add(rest);
		}
		return newNames;
	});

	const getSetupTemplateRefNames = computedSet(() => {
		const newNames = new Set(
			getScriptSetupRanges()?.useTemplateRef
				.map(({ name }) => name)
				.filter(name => name !== undefined),
		);
		return newNames;
	});

	const setupHasDefineSlots = computed(() => !!getScriptSetupRanges()?.defineSlots);

	const getSetupPropsAssignName = computed(() => getScriptSetupRanges()?.defineProps?.name);

	const getSetupSlotsAssignName = computed(() => getScriptSetupRanges()?.defineSlots?.name);

	const getSetupInheritAttrs = computed(() => {
		const value = getScriptSetupRanges()?.defineOptions?.inheritAttrs
			?? getScriptRanges()?.componentOptions?.inheritAttrs;
		return value !== 'false';
	});

	const getComponentSelfName = computed(() => {
		let name: string;
		const { componentOptions } = getScriptRanges() ?? {};
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
			ts,
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: getResolvedOptions(),
			template: sfc.template,
			destructuredPropNames: getDestructuredPropNames(),
			setupBindingNames: getSetupBindingNames(),
			templateRefNames: getSetupTemplateRefNames(),
			scriptSetupImportComponentNames: getSetupImportComponentNames(),
			hasDefineSlots: setupHasDefineSlots(),
			propsAssignName: getSetupPropsAssignName(),
			slotsAssignName: getSetupSlotsAssignName(),
			inheritAttrs: getSetupInheritAttrs(),
			selfComponentName: getComponentSelfName(),
		});
	});

	const getTemplateComponents = computedArray(() => {
		return sfc.template?.ast?.components ?? [];
	});

	const getTemplateStartTagOffset = computed(() => {
		if (sfc.template) {
			return sfc.template.start - sfc.template.startTagEnd;
		}
	});

	const getGeneratedScript = computed(() => {
		return generateScript({
			ts,
			vueCompilerOptions: getResolvedOptions(),
			script: sfc.script,
			scriptSetup: sfc.scriptSetup,
			setupBindingNames: getSetupBindingNames(),
			fileName,
			lang: getLang(),
			scriptRanges: getScriptRanges(),
			scriptSetupRanges: getScriptSetupRanges(),
			templateCodegen: getGeneratedTemplate(),
			templateComponents: getTemplateComponents(),
			templateStartTagOffset: getTemplateStartTagOffset(),
			styleCodegen: getGeneratedStyle(),
		});
	});

	const usedCssModule = computed(() => !!getScriptSetupRanges()?.useCssModule.length);

	const getGeneratedStyle = computed(() => {
		if (!sfc.styles.length) {
			return;
		}
		const generation = generateStyle({
			ts,
			vueCompilerOptions: getResolvedOptions(),
			usedCssModule: usedCssModule(),
			styles: sfc.styles,
			destructuredPropNames: getDestructuredPropNames(),
			templateRefNames: getSetupTemplateRefNames(),
			setupBindingNames: getSetupBindingNames(),
		});
		const codes: Code[] = [];
		let ctx: TemplateCodegenContext;

		while (true) {
			const result = generation.next();
			if (result.done) {
				ctx = result.value;
				break;
			}
			codes.push(result.value);
		}

		return {
			...ctx,
			codes,
		};
	});

	return {
		getLang,
		getScriptRanges,
		getScriptSetupRanges,
		getSetupSlotsAssignName,
		getGeneratedScript,
		getGeneratedTemplate,
	};
}

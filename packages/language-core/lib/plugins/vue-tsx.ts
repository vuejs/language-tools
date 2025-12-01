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
import type { Sfc, VueLanguagePlugin } from '../types';
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

	const getLang = computed(() => {
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
		const names = new Set<string>();
		const scriptSetupRanges = getScriptSetupRanges();
		if (!sfc.scriptSetup || !scriptSetupRanges) {
			return names;
		}
		for (const { range } of scriptSetupRanges.bindings) {
			const name = sfc.scriptSetup.content.slice(range.start, range.end);
			if (!getImportComponentNames().has(name)) {
				names.add(name);
			}
		}
		const scriptRanges = getScriptRanges();
		if (sfc.script && scriptRanges) {
			for (const { range } of scriptRanges.bindings) {
				const name = sfc.script.content.slice(range.start, range.end);
				if (!getImportComponentNames().has(name)) {
					names.add(name);
				}
			}
		}
		return names;
	});

	const getImportComponentNames = computedSet(() => {
		const names = new Set<string>();
		const scriptSetupRanges = getScriptSetupRanges();
		if (sfc.scriptSetup && scriptSetupRanges) {
			for (const { range, moduleName, isDefaultImport, isNamespace } of scriptSetupRanges.bindings) {
				if (
					moduleName
					&& isDefaultImport
					&& !isNamespace
					&& ctx.vueCompilerOptions.extensions.some(ext => moduleName.endsWith(ext))
				) {
					names.add(sfc.scriptSetup.content.slice(range.start, range.end));
				}
			}
			const scriptRange = getScriptRanges();
			if (sfc.script && scriptRange) {
				for (const { range, moduleName, isDefaultImport, isNamespace } of scriptRange.bindings) {
					if (
						moduleName
						&& isDefaultImport
						&& !isNamespace
						&& ctx.vueCompilerOptions.extensions.some(ext => moduleName.endsWith(ext))
					) {
						names.add(sfc.script.content.slice(range.start, range.end));
					}
				}
			}
		}
		return names;
	});

	const getDirectAccessNames = computedSet(() => {
		const scriptSetupRanges = getScriptSetupRanges();
		const names = new Set([
			...scriptSetupRanges?.defineProps?.destructured?.keys() ?? [],
			...getImportComponentNames(),
		]);
		const rest = scriptSetupRanges?.defineProps?.destructuredRest;
		if (rest) {
			names.add(rest);
		}
		return names;
	});

	const getTemplateRefNames = computedSet(() => {
		const newNames = new Set(
			getScriptSetupRanges()?.useTemplateRef
				.map(({ name }) => name)
				.filter(name => name !== undefined),
		);
		return newNames;
	});

	const hasDefineSlots = computed(() => !!getScriptSetupRanges()?.defineSlots);

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
			directAccessNames: getDirectAccessNames(),
			setupBindingNames: getSetupBindingNames(),
			templateRefNames: getTemplateRefNames(),
			hasDefineSlots: hasDefineSlots(),
			propsAssignName: getSetupPropsAssignName(),
			slotsAssignName: getSetupSlotsAssignName(),
			inheritAttrs: getSetupInheritAttrs(),
			selfComponentName: getComponentSelfName(),
		});
	});

	const getGeneratedStyle = computed(() => {
		if (!sfc.styles.length) {
			return;
		}
		return generateStyle({
			ts,
			vueCompilerOptions: getResolvedOptions(),
			styles: sfc.styles,
			directAccessNames: getDirectAccessNames(),
			templateRefNames: getTemplateRefNames(),
			setupBindingNames: getSetupBindingNames(),
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

	return {
		getLang,
		getScriptRanges,
		getScriptSetupRanges,
		getSetupSlotsAssignName,
		getGeneratedScript,
		getGeneratedTemplate,
		getImportComponentNames,
	};
}

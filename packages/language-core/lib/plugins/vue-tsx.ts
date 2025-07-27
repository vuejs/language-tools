import { camelize, capitalize } from '@vue/shared';
import { computed } from 'alien-signals';
import * as path from 'path-browserify';
import { createScriptCodegenContext, generateScript, type ScriptCodegenOptions } from '../codegen/script';
import { createTemplateCodegenContext, generateTemplate, type TemplateCodegenOptions } from '../codegen/template';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { parseVueCompilerOptions } from '../parsers/vueCompilerOptions';
import type { Code, Sfc, VueLanguagePlugin } from '../types';
import { computedSet } from '../utils/signals';
import { CompilerOptionsResolver } from '../utils/ts';

export const tsCodegen = new WeakMap<Sfc, ReturnType<typeof createTsx>>();

const validLangs = new Set(['js', 'jsx', 'ts', 'tsx']);

const plugin: VueLanguagePlugin = ctx => {
	return {
		version: 2.1,

		requiredCompilerOptions: [
			'noPropertyAccessFromIndexSignature',
			'exactOptionalPropertyTypes',
		],

		getEmbeddedCodes(fileName, sfc) {
			const codegen = useCodegen(fileName, sfc);
			return [{
				id: 'script_' + codegen.getLang(),
				lang: codegen.getLang(),
			}];
		},

		resolveEmbeddedCode(fileName, sfc, embeddedFile) {
			if (/script_(js|jsx|ts|tsx)/.test(embeddedFile.id)) {
				const codegen = useCodegen(fileName, sfc);
				const tsx = codegen.getGeneratedScript();
				if (tsx) {
					embeddedFile.content = [...tsx.codes];
				}
			}
		},
	};

	function useCodegen(fileName: string, sfc: Sfc) {
		if (!tsCodegen.has(sfc)) {
			tsCodegen.set(sfc, createTsx(fileName, sfc, ctx));
		}
		return tsCodegen.get(sfc)!;
	}
};

export default plugin;

function createTsx(
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
		const bindings = getScriptSetupRanges()?.bindings;
		if (sfc.scriptSetup && bindings) {
			for (const { range } of bindings) {
				newNames.add(sfc.scriptSetup.content.slice(range.start, range.end));
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

	const getSetupDestructuredPropNames = computedSet(() => {
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

	const getSetupSlotsAssignName = computed(() => getScriptSetupRanges()?.defineSlots?.name);

	const getSetupPropsAssignName = computed(() => getScriptSetupRanges()?.defineProps?.name);

	const getSetupInheritAttrs = computed(() => {
		const value = getScriptSetupRanges()?.defineOptions?.inheritAttrs
			?? getScriptRanges()?.exportDefault?.inheritAttrsOption;
		return value !== 'false';
	});

	const getComponentSelfName = computed(() => {
		const { exportDefault } = getScriptRanges() ?? {};
		if (sfc.script && exportDefault?.nameOption) {
			const { nameOption } = exportDefault;
			return sfc.script.content.slice(nameOption.start + 1, nameOption.end - 1);
		}
		const { defineOptions } = getScriptSetupRanges() ?? {};
		if (sfc.scriptSetup && defineOptions?.name) {
			return defineOptions.name;
		}
		const baseName = path.basename(fileName);
		return capitalize(camelize(baseName.slice(0, baseName.lastIndexOf('.'))));
	});

	const getGeneratedTemplate = computed(() => {
		if (getResolvedOptions().skipTemplateCodegen || !sfc.template) {
			return;
		}

		const options: TemplateCodegenOptions = {
			ts,
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: getResolvedOptions(),
			template: sfc.template,
			scriptSetupBindingNames: getSetupBindingNames(),
			scriptSetupImportComponentNames: getSetupImportComponentNames(),
			destructuredPropNames: getSetupDestructuredPropNames(),
			templateRefNames: getSetupTemplateRefNames(),
			hasDefineSlots: setupHasDefineSlots(),
			slotsAssignName: getSetupSlotsAssignName(),
			propsAssignName: getSetupPropsAssignName(),
			inheritAttrs: getSetupInheritAttrs(),
			selfComponentName: getComponentSelfName(),
		};
		const context = createTemplateCodegenContext(options, sfc.template.ast);
		const codegen = generateTemplate(options, context);

		const codes: Code[] = [];
		for (const code of codegen) {
			if (typeof code === 'object') {
				code[3] = context.resolveCodeFeatures(code[3]);
			}
			codes.push(code);
		}

		return {
			...context,
			codes,
		};
	});

	const getGeneratedScript = computed(() => {
		const options: ScriptCodegenOptions = {
			ts,
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: getResolvedOptions(),
			sfc: sfc,
			fileName,
			lang: getLang(),
			scriptRanges: getScriptRanges(),
			scriptSetupRanges: getScriptSetupRanges(),
			templateCodegen: getGeneratedTemplate(),
			destructuredPropNames: getSetupDestructuredPropNames(),
			templateRefNames: getSetupTemplateRefNames(),
		};
		const context = createScriptCodegenContext(options);
		const codegen = generateScript(options, context);

		return {
			...context,
			codes: [...codegen],
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

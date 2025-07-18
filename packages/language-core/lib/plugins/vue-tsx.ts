import { camelize, capitalize } from '@vue/shared';
import { computed } from 'alien-signals';
import * as path from 'path-browserify';
import { generateScript } from '../codegen/script';
import { generateTemplate } from '../codegen/template';
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
		let name: string;
		const { exportDefault } = getScriptRanges() ?? {};
		if (sfc.script && exportDefault?.nameOption) {
			name = sfc.script.content.slice(
				exportDefault.nameOption.start + 1,
				exportDefault.nameOption.end - 1,
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

		const codes: Code[] = [];
		const codegen = generateTemplate({
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
		});

		let current = codegen.next();
		while (!current.done) {
			const code = current.value;
			codes.push(code);
			current = codegen.next();
		}

		return {
			...current.value,
			codes,
		};
	});

	const getGeneratedScript = computed(() => {
		const codes: Code[] = [];
		const codegen = generateScript({
			ts,
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: getResolvedOptions(),
			sfc,
			fileName,
			lang: getLang(),
			scriptRanges: getScriptRanges(),
			scriptSetupRanges: getScriptSetupRanges(),
			templateCodegen: getGeneratedTemplate(),
			destructuredPropNames: getSetupDestructuredPropNames(),
			templateRefNames: getSetupTemplateRefNames(),
		});

		let current = codegen.next();
		while (!current.done) {
			const code = current.value;
			codes.push(code);
			current = codegen.next();
		}

		return {
			...current.value,
			codes,
		};
	});

	return {
		getScriptRanges,
		getScriptSetupRanges,
		getLang,
		getGeneratedScript,
		getGeneratedTemplate,
	};
}

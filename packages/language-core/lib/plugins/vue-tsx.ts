import type { Mapping } from '@volar/language-core';
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

const fileEditTimes = new Map<string, number>();

const plugin: VueLanguagePlugin = ctx => {

	let appendedGlobalTypes = false;

	return {

		version: 2.1,

		requiredCompilerOptions: [
			'noPropertyAccessFromIndexSignature',
			'exactOptionalPropertyTypes',
		],

		getEmbeddedCodes(fileName, sfc) {
			const codegen = useCodegen(fileName, sfc);
			const files: {
				id: string;
				lang: string;
			}[] = [];
			if (['js', 'ts', 'jsx', 'tsx'].includes(codegen.getLang())) {
				files.push({ id: 'script_' + codegen.getLang(), lang: codegen.getLang() });
			}
			return files;
		},

		resolveEmbeddedCode(fileName, sfc, embeddedFile) {
			if (/script_(js|jsx|ts|tsx)/.test(embeddedFile.id)) {
				const codegen = useCodegen(fileName, sfc);
				const tsx = codegen.getGeneratedScript();
				if (tsx) {
					embeddedFile.content = [...tsx.codes];
					embeddedFile.linkedCodeMappings = [...tsx.linkedCodeMappings];
				}
			}
		},
	};

	function useCodegen(fileName: string, sfc: Sfc) {
		if (!tsCodegen.has(sfc)) {
			let appendGlobalTypes = false;
			if (!ctx.vueCompilerOptions.__setupedGlobalTypes && !appendedGlobalTypes) {
				appendGlobalTypes = true;
				appendedGlobalTypes = true;
			}
			tsCodegen.set(sfc, createTsx(fileName, sfc, ctx, appendGlobalTypes));
		}
		return tsCodegen.get(sfc)!;
	}
};

export default plugin;

function createTsx(
	fileName: string,
	sfc: Sfc,
	ctx: Parameters<VueLanguagePlugin>[0],
	appendGlobalTypes: boolean
) {
	const ts = ctx.modules.typescript;

	const getLang = computed(() => {
		return !sfc.script && !sfc.scriptSetup ? 'ts'
			: sfc.scriptSetup && sfc.scriptSetup.lang !== 'js' ? sfc.scriptSetup.lang
				: sfc.script && sfc.script.lang !== 'js' ? sfc.script.lang
					: 'js';
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
		sfc.script
			? parseScriptRanges(ts, sfc.script.ast, !!sfc.scriptSetup, false)
			: undefined
	);

	const getScriptSetupRanges = computed(() =>
		sfc.scriptSetup
			? parseScriptSetupRanges(ts, sfc.scriptSetup.ast, getResolvedOptions())
			: undefined
	);

	const getSetupBindingNames = computedSet(
		computed(() => {
			const newNames = new Set<string>();
			const bindings = getScriptSetupRanges()?.bindings;
			if (sfc.scriptSetup && bindings) {
				for (const { range } of bindings) {
					newNames.add(sfc.scriptSetup.content.slice(range.start, range.end));
				}
			}
			return newNames;
		})
	);

	const getSetupImportComponentNames = computedSet(
		computed(() => {
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
		})
	);

	const getSetupDestructuredPropNames = computedSet(
		computed(() => {
			const newNames = new Set(getScriptSetupRanges()?.defineProps?.destructured?.keys());
			const rest = getScriptSetupRanges()?.defineProps?.destructuredRest;
			if (rest) {
				newNames.add(rest);
			}
			return newNames;
		})
	);

	const getSetupTemplateRefNames = computedSet(
		computed(() => {
			const newNames = new Set(
				getScriptSetupRanges()?.useTemplateRef
					.map(({ name }) => name)
					.filter(name => name !== undefined)
			);
			return newNames;
		})
	);

	const setupHasDefineSlots = computed(() => !!getScriptSetupRanges()?.defineSlots);

	const getSetupSlotsAssignName = computed(() => getScriptSetupRanges()?.defineSlots?.name);

	const getSetupPropsAssignName = computed(() => getScriptSetupRanges()?.defineProps?.name);

	const getSetupInheritAttrs = computed(() => {
		const value = getScriptSetupRanges()?.defineOptions?.inheritAttrs ?? getScriptRanges()?.exportDefault?.inheritAttrsOption;
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

		const codes: Code[] = [];
		const codegen = generateTemplate({
			ts,
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: getResolvedOptions(),
			template: sfc.template,
			edited: getResolvedOptions().__test || (fileEditTimes.get(fileName) ?? 0) >= 2,
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
		const linkedCodeMappings: Mapping[] = [];
		let generatedLength = 0;

		const codes: Code[] = [];
		const codegen = generateScript({
			ts,
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: getResolvedOptions(),
			sfc: sfc,
			edited: getResolvedOptions().__test || (fileEditTimes.get(fileName) ?? 0) >= 2,
			fileName,
			lang: getLang(),
			scriptRanges: getScriptRanges(),
			scriptSetupRanges: getScriptSetupRanges(),
			templateCodegen: getGeneratedTemplate(),
			destructuredPropNames: getSetupDestructuredPropNames(),
			templateRefNames: getSetupTemplateRefNames(),
			getGeneratedLength: () => generatedLength,
			linkedCodeMappings,
			appendGlobalTypes,
		});
		fileEditTimes.set(fileName, (fileEditTimes.get(fileName) ?? 0) + 1);

		let current = codegen.next();
		while (!current.done) {
			const code = current.value;
			codes.push(code);
			generatedLength += typeof code === 'string'
				? code.length
				: code[0].length;
			current = codegen.next();
		}

		return {
			...current.value,
			codes,
			linkedCodeMappings,
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

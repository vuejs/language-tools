import type { Mapping } from '@volar/language-core';
import { computed, Unstable } from 'alien-signals';
import { generateScript } from '../codegen/script';
import { generateTemplate } from '../codegen/template';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import type { Code, Sfc, VueLanguagePlugin } from '../types';

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
			const tsx = useTsx(fileName, sfc);
			const files: {
				id: string;
				lang: string;
			}[] = [];
			if (['js', 'ts', 'jsx', 'tsx'].includes(tsx.lang.get())) {
				files.push({ id: 'script_' + tsx.lang.get(), lang: tsx.lang.get() });
			}
			return files;
		},

		resolveEmbeddedCode(fileName, sfc, embeddedFile) {

			const _tsx = useTsx(fileName, sfc);

			if (/script_(js|jsx|ts|tsx)/.test(embeddedFile.id)) {
				const tsx = _tsx.generatedScript.get();
				if (tsx) {
					embeddedFile.content = [...tsx.codes];
					embeddedFile.linkedCodeMappings = [...tsx.linkedCodeMappings];
				}
			}
		},
	};

	function useTsx(fileName: string, sfc: Sfc) {
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
	_sfc: Sfc,
	ctx: Parameters<VueLanguagePlugin>[0],
	appendGlobalTypes: boolean
) {
	const ts = ctx.modules.typescript;
	const lang = computed(() => {
		return !_sfc.script && !_sfc.scriptSetup ? 'ts'
			: _sfc.scriptSetup && _sfc.scriptSetup.lang !== 'js' ? _sfc.scriptSetup.lang
				: _sfc.script && _sfc.script.lang !== 'js' ? _sfc.script.lang
					: 'js';
	});
	const scriptRanges = computed(() =>
		_sfc.script
			? parseScriptRanges(ts, _sfc.script.ast, !!_sfc.scriptSetup, false)
			: undefined
	);
	const scriptSetupRanges = computed(() =>
		_sfc.scriptSetup
			? parseScriptSetupRanges(ts, _sfc.scriptSetup.ast, ctx.vueCompilerOptions)
			: undefined
	);
	const scriptSetupBindingNames = Unstable.computedSet(
		computed(() => {
			const newNames = new Set<string>();
			const bindings = scriptSetupRanges.get()?.bindings;
			if (_sfc.scriptSetup && bindings) {
				for (const { range } of bindings) {
					newNames.add(_sfc.scriptSetup.content.slice(range.start, range.end));
				}
			}
			return newNames;
		})
	);
	const scriptSetupImportComponentNames = Unstable.computedSet(
		computed(() => {
			const newNames = new Set<string>();
			const bindings = scriptSetupRanges.get()?.bindings;
			if (_sfc.scriptSetup && bindings) {
				for (const { range, moduleName, isDefaultImport, isNamespace } of bindings) {
					if (
						moduleName
						&& isDefaultImport
						&& !isNamespace
						&& ctx.vueCompilerOptions.extensions.some(ext => moduleName.endsWith(ext))
					) {
						newNames.add(_sfc.scriptSetup.content.slice(range.start, range.end));
					}
				}
			}
			return newNames;
		})
	);
	const destructuredPropNames = Unstable.computedSet(
		computed(() => {
			const newNames = new Set(scriptSetupRanges.get()?.defineProps?.destructured);
			const rest = scriptSetupRanges.get()?.defineProps?.destructuredRest;
			if (rest) {
				newNames.add(rest);
			}
			return newNames;
		})
	);
	const templateRefNames = Unstable.computedSet(
		computed(() => {
			const newNames = new Set(
				scriptSetupRanges.get()?.useTemplateRef
					.map(({ name }) => name)
					.filter(name => name !== undefined)
			);
			return newNames;
		})
	);
	const hasDefineSlots = computed(() => !!scriptSetupRanges.get()?.defineSlots);
	const slotsAssignName = computed(() => scriptSetupRanges.get()?.defineSlots?.name);
	const propsAssignName = computed(() => scriptSetupRanges.get()?.defineProps?.name);
	const inheritAttrs = computed(() => {
		const value = scriptSetupRanges.get()?.defineOptions?.inheritAttrs ?? scriptRanges.get()?.exportDefault?.inheritAttrsOption;
		return value !== 'false';
	});
	const generatedTemplate = computed(() => {

		if (ctx.vueCompilerOptions.skipTemplateCodegen || !_sfc.template) {
			return;
		}

		const codes: Code[] = [];
		const codegen = generateTemplate({
			ts,
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: ctx.vueCompilerOptions,
			template: _sfc.template,
			edited: ctx.vueCompilerOptions.__test || (fileEditTimes.get(fileName) ?? 0) >= 2,
			scriptSetupBindingNames: scriptSetupBindingNames.get(),
			scriptSetupImportComponentNames: scriptSetupImportComponentNames.get(),
			destructuredPropNames: destructuredPropNames.get(),
			templateRefNames: templateRefNames.get(),
			hasDefineSlots: hasDefineSlots.get(),
			slotsAssignName: slotsAssignName.get(),
			propsAssignName: propsAssignName.get(),
			inheritAttrs: inheritAttrs.get(),
		});

		let current = codegen.next();

		while (!current.done) {
			const code = current.value;
			codes.push(code);
			current = codegen.next();
		}

		return {
			...current.value,
			codes: codes,
		};
	});
	const generatedScript = computed(() => {
		const codes: Code[] = [];
		const linkedCodeMappings: Mapping[] = [];
		let generatedLength = 0;
		const codegen = generateScript({
			ts,
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: ctx.vueCompilerOptions,
			sfc: _sfc,
			edited: ctx.vueCompilerOptions.__test || (fileEditTimes.get(fileName) ?? 0) >= 2,
			fileName,
			lang: lang.get(),
			scriptRanges: scriptRanges.get(),
			scriptSetupRanges: scriptSetupRanges.get(),
			templateCodegen: generatedTemplate.get(),
			destructuredPropNames: destructuredPropNames.get(),
			templateRefNames: templateRefNames.get(),
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
		scriptRanges,
		scriptSetupRanges,
		lang,
		generatedScript,
		generatedTemplate,
	};
}

import type { Mapping } from '@volar/language-core';
import { computed } from 'alien-signals';
import { posix as path } from 'path-browserify';
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
					const content: Code[] = [...tsx.codes];
					embeddedFile.content = content;
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
	const isTs = computed(() => {
		return lang.get() !== 'js' && lang.get() !== 'jsx';
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
	const scriptSetupBindingNames = computed<Set<string>>(oldNames => {
		const newNames = new Set<string>();
		const bindings = scriptSetupRanges.get()?.bindings;
		if (_sfc.scriptSetup && bindings) {
			for (const binding of bindings) {
				newNames.add(_sfc.scriptSetup?.content.substring(binding.start, binding.end));
			}
		}
		if (newNames && oldNames && twoSetsEqual(newNames, oldNames)) {
			return oldNames;
		}
		return newNames;
	});
	const scriptSetupImportComponentNames = computed<Set<string>>(oldNames => {
		const newNames = scriptSetupRanges.get()?.importComponentNames ?? new Set();
		if (oldNames && twoSetsEqual(newNames, oldNames)) {
			return oldNames;
		}
		return newNames;
	});
	const destructuredPropNames = computed<Set<string>>(oldNames => {
		const newNames = scriptSetupRanges.get()?.props.destructured ?? new Set();
		const rest = scriptSetupRanges.get()?.props.destructuredRest;
		if (rest) {
			newNames.add(rest);
		}
		if (oldNames && twoSetsEqual(newNames, oldNames)) {
			return oldNames;
		}
		return newNames;
	});
	const templateRefNames = computed<Set<string>>(oldNames => {
		const newNames = new Set(
			scriptSetupRanges.get()?.templateRefs
				.map(({ name }) => name)
				.filter(name => name !== undefined)
		);
		if (oldNames && twoSetsEqual(newNames, oldNames)) {
			return oldNames;
		}
		return newNames;
	});
	const hasDefineSlots = computed(() => !!scriptSetupRanges.get()?.slots.define);
	const slotsAssignName = computed(() => scriptSetupRanges.get()?.slots.name);
	const propsAssignName = computed(() => scriptSetupRanges.get()?.props.name);
	const inheritAttrs = computed(() => {
		const value = scriptSetupRanges.get()?.options.inheritAttrs ?? scriptRanges.get()?.exportDefault?.inheritAttrsOption;
		return value !== 'false';
	});
	const generatedScript = computed(() => {
		const codes: Code[] = [];
		const linkedCodeMappings: Mapping[] = [];
		let generatedLength = 0;
		const codegen = generateScript({
			ts,
			fileBaseName: path.basename(fileName),
			sfc: _sfc,
			lang: lang.get(),
			isTs: isTs.get(),
			scriptRanges: scriptRanges.get(),
			scriptSetupRanges: scriptSetupRanges.get(),
			templateCodegen: generatedTemplate.get(),
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: ctx.vueCompilerOptions,
			edited: ctx.vueCompilerOptions.__test || (fileEditTimes.get(fileName) ?? 0) >= 2,
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

function twoSetsEqual(a: Set<string>, b: Set<string>) {
	if (a.size !== b.size) {
		return false;
	}
	for (const file of a) {
		if (!b.has(file)) {
			return false;
		}
	}
	return true;
}

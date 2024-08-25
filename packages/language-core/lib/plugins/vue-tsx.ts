import type { Mapping } from '@volar/language-core';
import { computed } from 'computeds';
import * as path from 'path-browserify';
import { generateScript } from '../codegen/script';
import { generateTemplate } from '../codegen/template';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import type { Code, Sfc, VueLanguagePlugin } from '../types';

export const tsCodegen = new WeakMap<Sfc, ReturnType<typeof createTsx>>();

const plugin: VueLanguagePlugin = ctx => {

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
			if (['js', 'ts', 'jsx', 'tsx'].includes(tsx.lang())) {
				files.push({ id: 'script_' + tsx.lang(), lang: tsx.lang() });
			}
			return files;
		},

		resolveEmbeddedCode(fileName, sfc, embeddedFile) {

			const _tsx = useTsx(fileName, sfc);

			if (/script_(js|jsx|ts|tsx)/.test(embeddedFile.id)) {
				const tsx = _tsx.generatedScript();
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
			tsCodegen.set(sfc, createTsx(fileName, sfc, ctx));
		}
		return tsCodegen.get(sfc)!;
	}
};

export default plugin;

function createTsx(
	fileName: string,
	_sfc: Sfc,
	ctx: Parameters<VueLanguagePlugin>[0]
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
	const generatedTemplate = computed(() => {

		if (!_sfc.template) {
			return;
		}

		const codes: Code[] = [];
		const codegen = generateTemplate({
			ts,
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: ctx.vueCompilerOptions,
			template: _sfc.template,
			scriptSetupBindingNames: scriptSetupBindingNames(),
			scriptSetupImportComponentNames: scriptSetupImportComponentNames(),
			hasDefineSlots: hasDefineSlots(),
			slotsAssignName: slotsAssignName(),
			propsAssignName: propsAssignName(),
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
	const hasDefineSlots = computed(() => !!scriptSetupRanges()?.slots.define);
	const scriptSetupBindingNames = computed<Set<string>>(oldNames => {
		const newNames = new Set<string>();
		const bindings = scriptSetupRanges()?.bindings;
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
		const newNames = scriptSetupRanges()?.importComponentNames ?? new Set();
		if (newNames && oldNames && twoSetsEqual(newNames, oldNames)) {
			return oldNames;
		}
		return newNames;
	});
	const slotsAssignName = computed(() => scriptSetupRanges()?.slots.name);
	const propsAssignName = computed(() => scriptSetupRanges()?.props.name);
	const generatedScript = computed(() => {
		const codes: Code[] = [];
		const linkedCodeMappings: Mapping[] = [];
		const _template = generatedTemplate();
		let generatedLength = 0;
		const codegen = generateScript({
			ts,
			fileBaseName: path.basename(fileName),
			globalTypes: ctx.globalTypesHolder === fileName,
			sfc: _sfc,
			lang: lang(),
			scriptRanges: scriptRanges(),
			scriptSetupRanges: scriptSetupRanges(),
			templateCodegen: _template,
			compilerOptions: ctx.compilerOptions,
			vueCompilerOptions: ctx.vueCompilerOptions,
			getGeneratedLength: () => generatedLength,
			linkedCodeMappings,
		});

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

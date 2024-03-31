import { Mapping, StackNode, track } from '@volar/language-core';
import { computed, computedSet } from 'computeds';
import { generate as generateScript } from '../generators/script';
import { generate as generateTemplate } from '../generators/template';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import type { Code, Sfc, VueLanguagePlugin } from '../types';

export const tsCodegen = new WeakMap<Sfc, ReturnType<typeof createTsx>>();

const plugin: VueLanguagePlugin = ctx => {

	return {

		version: 2,

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

			if (embeddedFile.id.startsWith('script_')) {
				const tsx = _tsx.generatedScript();
				if (tsx) {
					const [content, contentStacks] = ctx.codegenStack ? track([...tsx.codes], [...tsx.codeStacks]) : [[...tsx.codes], [...tsx.codeStacks]];
					embeddedFile.content = content;
					embeddedFile.contentStacks = contentStacks;
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
	ctx: Parameters<VueLanguagePlugin>[0],
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
	const shouldGenerateScopedClasses = computed(() => {
		const option = ctx.vueCompilerOptions.experimentalResolveStyleCssClasses;
		return _sfc.styles.some(s => {
			return option === 'always' || (option === 'scoped' && s.scoped);
		});
	});
	const stylesScopedClasses = computedSet(() => {

		const classes = new Set<string>();

		if (!shouldGenerateScopedClasses()) {
			return classes;
		}

		for (const style of _sfc.styles) {
			const option = ctx.vueCompilerOptions.experimentalResolveStyleCssClasses;
			if (option === 'always' || (option === 'scoped' && style.scoped)) {
				for (const className of style.classNames) {
					classes.add(className.text.substring(1));
				}
			}
		}

		return classes;
	});
	const generatedTemplate = computed(() => {

		if (!_sfc.template) {
			return;
		}

		const tsCodes: Code[] = [];
		const tsCodegenStacks: string[] = [];
		const codegen = generateTemplate(
			ts,
			ctx.compilerOptions,
			ctx.vueCompilerOptions,
			_sfc.template,
			shouldGenerateScopedClasses(),
			stylesScopedClasses(),
			hasScriptSetupSlots(),
			slotsAssignName(),
			propsAssignName(),
			ctx.codegenStack,
		);

		let current = codegen.next();

		while (!current.done) {
			const [code, stack] = current.value;
			tsCodes.push(code);
			if (ctx.codegenStack) {
				tsCodegenStacks.push(stack);
			}
			current = codegen.next();
		}

		return {
			...current.value,
			codes: tsCodes,
			codeStacks: tsCodegenStacks,
		};
	});
	const hasScriptSetupSlots = computed(() => !!scriptSetupRanges()?.slots.define);
	const slotsAssignName = computed(() => scriptSetupRanges()?.slots.name);
	const propsAssignName = computed(() => scriptSetupRanges()?.props.name);
	const generatedScript = computed(() => {
		const codes: Code[] = [];
		const codeStacks: StackNode[] = [];
		const linkedCodeMappings: Mapping[] = [];
		const _template = generatedTemplate();
		let generatedLength = 0;
		for (const [code, stack] of generateScript(
			ts,
			fileName,
			_sfc.script,
			_sfc.scriptSetup,
			_sfc.styles,
			lang(),
			scriptRanges(),
			scriptSetupRanges(),
			_template ? {
				tsCodes: _template.codes,
				tsCodegenStacks: _template.codeStacks,
				accessedGlobalVariables: _template.accessedGlobalVariables,
				hasSlot: _template.hasSlot,
				tagNames: new Set(_template.tagOffsetsMap.keys()),
			} : undefined,
			ctx.compilerOptions,
			ctx.vueCompilerOptions,
			ctx.globalTypesHolder,
			() => generatedLength,
			linkedCodeMappings,
			ctx.codegenStack,
		)) {
			codes.push(code);
			if (ctx.codegenStack) {
				codeStacks.push({ stack, length: 1 });
			}
			generatedLength += typeof code === 'string'
				? code.length
				: code[0].length;
		};
		return {
			codes,
			codeStacks,
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

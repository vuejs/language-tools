import { CodeInformation, Mapping, Segment, StackNode, track } from '@volar/language-core';
import { computed, computedSet } from 'computeds';
import { generate as generateScript } from '../generators/script';
import { generate as generateTemplate } from '../generators/template';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { Code, Sfc, VueLanguagePlugin } from '../types';
import { enableAllFeatures } from '../generators/utils';

export const tsCodegen = new WeakMap<Sfc, ReturnType<typeof createTsx>>();

const plugin: VueLanguagePlugin = (ctx) => {

	return {

		version: 2,

		requiredCompilerOptions: [
			'noPropertyAccessFromIndexSignature',
			'exactOptionalPropertyTypes',
		],

		getEmbeddedFiles(fileName, sfc) {

			const tsx = useTsx(fileName, sfc);
			const files: {
				id: string;
				lang: string;
			}[] = [];

			if (['js', 'ts', 'jsx', 'tsx'].includes(tsx.lang())) {
				files.push({ id: 'script_' + tsx.lang(), lang: tsx.lang() });
			}

			if (sfc.template) {
				files.push({ id: 'template_format', lang: 'ts' });
				files.push({ id: 'template_style', lang: 'css' });
			}

			return files;
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {

			const _tsx = useTsx(fileName, sfc);

			if (embeddedFile.id.startsWith('script_')) {
				const tsx = _tsx.generatedScript();
				if (tsx) {
					const [content, contentStacks] = ctx.codegenStack ? track([...tsx.codes], [...tsx.codeStacks]) : [[...tsx.codes], [...tsx.codeStacks]];
					content.forEach(code => {
						if (typeof code !== 'string') {
							code[3].structure = false;
							code[3].format = false;
						}
					});
					embeddedFile.content = content;
					embeddedFile.contentStacks = contentStacks;
					embeddedFile.linkedCodeMappings = [...tsx.linkedCodeMappings];
				}
			}
			else if (embeddedFile.id === 'template_format') {

				embeddedFile.parentFileId = 'template';

				const template = _tsx.generatedTemplate();
				if (template) {
					const [content, contentStacks] = ctx.codegenStack
						? track([...template.formatCodes], template.formatCodeStacks.map(stack => ({ stack, length: 1 })))
						: [[...template.formatCodes], template.formatCodeStacks.map(stack => ({ stack, length: 1 }))];
					embeddedFile.content = content;
					embeddedFile.contentStacks = contentStacks;
				}

				for (const style of sfc.styles) {
					embeddedFile.content.push('\n\n');
					for (const cssVar of style.cssVars) {
						embeddedFile.content.push('(');
						embeddedFile.content.push([
							cssVar.text,
							style.name,
							cssVar.offset,
							enableAllFeatures({}),
						]);
						embeddedFile.content.push(');\n');
					}
				}
			}
			else if (embeddedFile.id === 'template_style') {

				embeddedFile.parentFileId = 'template';

				const template = _tsx.generatedTemplate();
				if (template) {
					const [content, contentStacks] = ctx.codegenStack
						? track([...template.cssCodes], template.cssCodeStacks.map(stack => ({ stack, length: 1 })))
						: [[...template.cssCodes], template.cssCodeStacks.map(stack => ({ stack, length: 1 }))];
					embeddedFile.content = content as Segment<CodeInformation>[];
					embeddedFile.contentStacks = contentStacks;
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

		if (!_sfc.template)
			return;

		const tsCodes: Code[] = [];
		const tsFormatCodes: Code[] = [];
		const inlineCssCodes: Code[] = [];
		const tsCodegenStacks: string[] = [];
		const tsFormatCodegenStacks: string[] = [];
		const inlineCssCodegenStacks: string[] = [];
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
			const [type, code, stack] = current.value;
			if (type === 'ts') {
				tsCodes.push(code);
			}
			else if (type === 'tsFormat') {
				tsFormatCodes.push(code);
			}
			else if (type === 'inlineCss') {
				inlineCssCodes.push(code);
			}
			if (ctx.codegenStack) {
				if (type === 'ts') {
					tsCodegenStacks.push(stack);
				}
				else if (type === 'tsFormat') {
					tsFormatCodegenStacks.push(stack);
				}
				else if (type === 'inlineCss') {
					inlineCssCodegenStacks.push(stack);
				}
			}
			current = codegen.next();
		}

		return {
			...current.value,
			codes: tsCodes,
			codeStacks: tsCodegenStacks,
			formatCodes: tsFormatCodes,
			formatCodeStacks: tsFormatCodegenStacks,
			cssCodes: inlineCssCodes,
			cssCodeStacks: inlineCssCodegenStacks,
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

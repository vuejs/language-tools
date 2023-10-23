import { computed, computedSet } from 'computeds';
import { generate as generateScript } from '../generators/script';
import { generate as generateTemplate } from '../generators/template';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { Sfc, VueLanguagePlugin } from '../types';
import { FileCapabilities, FileKind } from '@volar/language-core';
import * as muggle from 'muggle-string';

const templateFormatReg = /^\.template_format\.ts$/;
const templateStyleCssReg = /^\.template_style\.css$/;

export const tsCodegen = new WeakMap<Sfc, ReturnType<typeof createTsx>>();

const plugin: VueLanguagePlugin = (ctx) => {

	return {

		version: 1,

		requiredCompilerOptions: [
			'noPropertyAccessFromIndexSignature',
			'exactOptionalPropertyTypes',
		],

		getEmbeddedFileNames(fileName, sfc) {

			const tsx = useTsx(fileName, sfc);
			const fileNames: string[] = [];

			if (['js', 'ts', 'jsx', 'tsx'].includes(tsx.lang())) {
				fileNames.push(fileName + '.' + tsx.lang());
			}

			if (sfc.template) {
				fileNames.push(fileName + '.template_format.ts');
				fileNames.push(fileName + '.template_style.css');
			}

			return fileNames;
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {

			const _tsx = useTsx(fileName, sfc);
			const suffix = embeddedFile.fileName.replace(fileName, '');

			if (suffix === '.' + _tsx.lang()) {
				embeddedFile.kind = FileKind.TypeScriptHostFile;
				embeddedFile.capabilities = {
					...FileCapabilities.full,
					foldingRange: false,
					documentFormatting: false,
					documentSymbol: false,
				};
				const tsx = _tsx.generatedScript();
				if (tsx) {
					const [content, contentStacks] = ctx.codegenStack ? muggle.track([...tsx.codes], [...tsx.codeStacks]) : [[...tsx.codes], [...tsx.codeStacks]];
					embeddedFile.content = content;
					embeddedFile.contentStacks = contentStacks;
					embeddedFile.mirrorBehaviorMappings = [...tsx.mirrorBehaviorMappings];
				}
			}
			else if (suffix.match(templateFormatReg)) {

				embeddedFile.parentFileName = fileName + '.template.' + sfc.template?.lang;
				embeddedFile.kind = FileKind.TextFile;
				embeddedFile.capabilities = {
					...FileCapabilities.full,
					diagnostic: false,
					foldingRange: false,
					codeAction: false,
					inlayHint: false,
				};

				const template = _tsx.generatedTemplate();
				if (template) {
					const [content, contentStacks] = ctx.codegenStack
						? muggle.track([...template.formatCodes], [...template.formatCodeStacks])
						: [[...template.formatCodes], [...template.formatCodeStacks]];
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
							{},
						]);
						embeddedFile.content.push(');\n');
					}
				}
			}
			else if (suffix.match(templateStyleCssReg)) {

				embeddedFile.parentFileName = fileName + '.template.' + sfc.template?.lang;

				const template = _tsx.generatedTemplate();
				if (template) {
					const [content, contentStacks] = ctx.codegenStack
						? muggle.track([...template.cssCodes], [...template.cssCodeStacks])
						: [[...template.cssCodes], [...template.cssCodeStacks]];
					embeddedFile.content = content;
					embeddedFile.contentStacks = contentStacks;
				}

				// for color pickers support
				embeddedFile.capabilities.documentSymbol = true;
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

function createTsx(fileName: string, _sfc: Sfc, { vueCompilerOptions, compilerOptions, codegenStack, modules }: Parameters<VueLanguagePlugin>[0]) {

	const ts = modules.typescript;
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
			? parseScriptSetupRanges(ts, _sfc.scriptSetup.ast, vueCompilerOptions)
			: undefined
	);
	const shouldGenerateScopedClasses = computed(() => {
		const option = vueCompilerOptions.experimentalResolveStyleCssClasses;
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
			const option = vueCompilerOptions.experimentalResolveStyleCssClasses;
			if ((option === 'always' || option === 'scoped') && style.scoped) {
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

		return generateTemplate(
			ts,
			compilerOptions,
			vueCompilerOptions,
			_sfc.template,
			shouldGenerateScopedClasses(),
			stylesScopedClasses(),
			hasScriptSetupSlots(),
			slotsAssignName(),
			propsAssignName(),
			codegenStack,
		);
	});
	const hasScriptSetupSlots = computed(() => !!scriptSetupRanges()?.slots.define);
	const slotsAssignName = computed(() => scriptSetupRanges()?.slots.name);
	const propsAssignName = computed(() => scriptSetupRanges()?.props.name);
	const generatedScript = computed(() => generateScript(
		ts,
		fileName,
		_sfc.script,
		_sfc.scriptSetup,
		_sfc.styles,
		lang(),
		scriptRanges(),
		scriptSetupRanges(),
		generatedTemplate(),
		compilerOptions,
		vueCompilerOptions,
		codegenStack,
	));

	return {
		scriptRanges,
		scriptSetupRanges,
		lang,
		generatedScript,
		generatedTemplate,
	};
}

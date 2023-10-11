import { computed, shallowRef as ref } from '@vue/reactivity';
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

			if (['js', 'ts', 'jsx', 'tsx'].includes(tsx.lang.value)) {
				fileNames.push(fileName + '.' + tsx.lang.value);
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

			if (suffix === '.' + _tsx.lang.value) {
				embeddedFile.kind = FileKind.TypeScriptHostFile;
				embeddedFile.capabilities = {
					...FileCapabilities.full,
					foldingRange: false,
					documentFormatting: false,
					documentSymbol: false,
				};
				const tsx = _tsx.generatedScript.value;
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

				if (_tsx.generatedTemplate.value) {
					const [content, contentStacks] = ctx.codegenStack ? muggle.track([..._tsx.generatedTemplate.value.formatCodes], [..._tsx.generatedTemplate.value.formatCodeStacks]) : [[..._tsx.generatedTemplate.value.formatCodes], [..._tsx.generatedTemplate.value.formatCodeStacks]];
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

				if (_tsx.generatedTemplate.value) {
					const [content, contentStacks] = ctx.codegenStack ? muggle.track([..._tsx.generatedTemplate.value.cssCodes], [..._tsx.generatedTemplate.value.cssCodeStacks]) : [[..._tsx.generatedTemplate.value.cssCodes], [..._tsx.generatedTemplate.value.cssCodeStacks]];
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
		_sfc.scriptAst
			? parseScriptRanges(ts, _sfc.scriptAst, !!_sfc.scriptSetup, false)
			: undefined
	);
	const scriptSetupRanges = computed(() =>
		_sfc.scriptSetupAst
			? parseScriptSetupRanges(ts, _sfc.scriptSetupAst, vueCompilerOptions)
			: undefined
	);
	const generatedTemplate = computed(() => {

		if (!_sfc.templateAst)
			return;

		return generateTemplate(
			ts,
			compilerOptions,
			vueCompilerOptions,
			_sfc.template?.content ?? '',
			_sfc.template?.lang ?? 'html',
			_sfc,
			hasScriptSetupSlots.value,
			slotsAssignName.value,
			propsAssignName.value,
			codegenStack,
		);
	});

	//#region remove when https://github.com/vuejs/core/pull/5912 merged
	const hasScriptSetupSlots = ref(false);
	const slotsAssignName = ref<string>();
	const propsAssignName = ref<string>();
	//#endregion

	const generatedScript = computed(() => {
		hasScriptSetupSlots.value = !!scriptSetupRanges.value?.defineSlots;
		slotsAssignName.value = scriptSetupRanges.value?.slotsAssignName;
		propsAssignName.value = scriptSetupRanges.value?.propsAssignName;
		return generateScript(
			ts,
			fileName,
			_sfc,
			lang.value,
			scriptRanges.value,
			scriptSetupRanges.value,
			generatedTemplate.value,
			compilerOptions,
			vueCompilerOptions,
			codegenStack,
		);
	});

	return {
		scriptRanges,
		scriptSetupRanges,
		lang,
		generatedScript,
		generatedTemplate,
	};
}

import { computed, shallowRef as ref } from '@vue/reactivity';
import { generate as genScript } from '../generators/script';
import * as templateGen from '../generators/template';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { Sfc, VueLanguagePlugin } from '../types';
import { FileCapabilities, FileKind } from '@volar/language-core';
import * as sharedTypes from '../utils/directorySharedTypes';
import * as muggle from 'muggle-string';

const plugin: VueLanguagePlugin = ({ modules, vueCompilerOptions, compilerOptions, codegenStack }) => {

	const ts = modules.typescript;
	const instances = new WeakMap<Sfc, ReturnType<typeof createTsx>>();
	const sharedTypesImport = sharedTypes.getImportName(compilerOptions);

	return {

		version: 1,

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
				const tsx = _tsx.tsxGen.value;
				if (tsx) {
					const [content, contentStacks] = codegenStack ? muggle.track([...tsx.codes], [...tsx.codeStacks]) : [[...tsx.codes], [...tsx.codeStacks]];
					embeddedFile.content = content;
					embeddedFile.contentStacks = contentStacks;
					embeddedFile.mirrorBehaviorMappings = [...tsx.mirrorBehaviorMappings];
				}
			}
			else if (suffix.match(/^\.template_format\.ts$/)) {

				embeddedFile.parentFileName = fileName + '.template.' + sfc.template?.lang;
				embeddedFile.kind = FileKind.TextFile;
				embeddedFile.capabilities = {
					...FileCapabilities.full,
					diagnostic: false,
					foldingRange: false,
					codeAction: false,
					inlayHint: false,
				};

				if (_tsx.htmlGen.value) {
					const [content, contentStacks] = codegenStack ? muggle.track([..._tsx.htmlGen.value.formatCodes], [..._tsx.htmlGen.value.formatCodeStacks]) : [[..._tsx.htmlGen.value.formatCodes], [..._tsx.htmlGen.value.formatCodeStacks]];
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
			else if (suffix.match(/^\.template_style\.css$/)) {

				embeddedFile.parentFileName = fileName + '.template.' + sfc.template?.lang;

				if (_tsx.htmlGen.value) {
					const [content, contentStacks] = codegenStack ? muggle.track([..._tsx.htmlGen.value.cssCodes], [..._tsx.htmlGen.value.cssCodeStacks]) : [[..._tsx.htmlGen.value.cssCodes], [..._tsx.htmlGen.value.cssCodeStacks]];
					embeddedFile.content = content;
					embeddedFile.contentStacks = contentStacks;
				}

				// for color pickers support
				embeddedFile.capabilities.documentSymbol = true;
			}
		},
	};

	function useTsx(fileName: string, sfc: Sfc) {
		if (!instances.has(sfc)) {
			instances.set(sfc, createTsx(fileName, sfc));
		}
		return instances.get(sfc)!;
	}

	function createTsx(fileName: string, _sfc: Sfc) {

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
		const htmlGen = computed(() => {

			if (!_sfc.templateAst)
				return;

			return templateGen.generate(
				ts,
				compilerOptions,
				vueCompilerOptions,
				_sfc.template?.content ?? '',
				_sfc.template?.lang ?? 'html',
				_sfc,
				hasScriptSetupSlots.value,
				sharedTypesImport,
				codegenStack,
			);
		});
		const hasScriptSetupSlots = ref(false); // remove when https://github.com/vuejs/core/pull/5912 merged
		const tsxGen = computed(() => {
			hasScriptSetupSlots.value = !!scriptSetupRanges.value?.slotsTypeArg;
			return genScript(
				ts,
				fileName,
				_sfc,
				lang.value,
				scriptRanges.value,
				scriptSetupRanges.value,
				htmlGen.value,
				compilerOptions,
				vueCompilerOptions,
				sharedTypesImport,
				codegenStack,
			);
		});

		return {
			lang,
			tsxGen,
			htmlGen,
		};
	}
};
export default plugin;

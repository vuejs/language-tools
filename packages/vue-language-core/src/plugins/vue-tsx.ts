import { computed } from '@vue/reactivity';
import { generate as genScript } from '../generators/script';
import * as templateGen from '../generators/template';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { Sfc, useCssVars, useStyleCssClasses, VueLanguagePlugin } from '../sourceFile';
import { SearchTexts } from '../utils/string';

const plugin: VueLanguagePlugin = ({ modules, vueCompilerOptions, compilerOptions }) => {

	const ts = modules.typescript;
	const gen = new WeakMap<Sfc, ReturnType<typeof createGen>>();

	return {

		getEmbeddedFileNames(fileName, sfc) {

			const fileNames: string[] = [];

			if (!fileName.endsWith('.html')) {
				const _gen = useGen(fileName, sfc);
				fileNames.push(fileName + '.' + _gen?.lang.value);
			}
			if (sfc.template) {
				fileNames.push(fileName + '.__VLS_template_format.tsx');
				fileNames.push(fileName + '.__VLS_template.css');
			}

			return fileNames;
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {
			const suffix = embeddedFile.fileName.replace(fileName, '');
			const _gen = useGen(fileName, sfc);
			if (suffix === '.' + _gen?.lang.value) {
				embeddedFile.isTsHostFile = true;
				embeddedFile.capabilities = {
					diagnostics: true,
					foldingRanges: false,
					formatting: false,
					documentSymbol: false,
					codeActions: true,
					inlayHints: true,
				};
				const tsx = _gen?.tsxGen.value;
				if (tsx) {
					embeddedFile.codeGen = tsx.codeGen;
					embeddedFile.teleportMappings = tsx.teleports;
				}
			}
			else if (suffix.match(/^\.__VLS_template_format\.tsx$/)) {

				embeddedFile.parentFileName = fileName + '.' + sfc.template?.lang;
				embeddedFile.capabilities = {
					diagnostics: false,
					foldingRanges: false,
					formatting: true,
					documentSymbol: true,
					codeActions: false,
					inlayHints: false,
				};
				embeddedFile.isTsHostFile = false;

				if (_gen?.htmlGen.value) {
					embeddedFile.codeGen = _gen.htmlGen.value.formatCodeGen;
				}
			}
			else if (suffix.match(/^\.__VLS_template\.css$/)) {

				embeddedFile.parentFileName = fileName + '.' + sfc.template?.lang;

				if (_gen?.htmlGen.value) {
					embeddedFile.codeGen = _gen.htmlGen.value.cssCodeGen;
				}
			}
		},
	};

	function useGen(fileName: string, sfc: Sfc) {
		if (!gen.has(sfc)) {
			gen.set(sfc, createGen(fileName, sfc));
		}
		return gen.get(sfc);
	}

	function createGen(fileName: string, sfc: Sfc) {

		const lang = computed(() => {
			let lang = !sfc.script && !sfc.scriptSetup ? 'ts'
				: sfc.scriptSetup && sfc.scriptSetup.lang !== 'js' ? sfc.scriptSetup.lang
					: sfc.script && sfc.script.lang !== 'js' ? sfc.script.lang
						: 'js';
			const disableTemplateScript = vueCompilerOptions.experimentalDisableTemplateSupport || compilerOptions.jsx !== ts.JsxEmit.Preserve;
			if (!disableTemplateScript) {
				if (lang === 'js') {
					lang = 'jsx';
				}
				else if (lang === 'ts') {
					lang = 'tsx';
				}
			}
			return lang;
		});
		const cssVars = useCssVars(sfc);
		const scriptRanges = computed(() =>
			sfc.scriptAst
				? parseScriptRanges(ts, sfc.scriptAst, !!sfc.scriptSetup, false, false)
				: undefined
		);
		const scriptSetupRanges = computed(() =>
			sfc.scriptSetupAst
				? parseScriptSetupRanges(ts, sfc.scriptSetupAst)
				: undefined
		);
		const cssModuleClasses = useStyleCssClasses(sfc, style => !!style.module);
		const cssScopedClasses = useStyleCssClasses(sfc, style => {
			const setting = vueCompilerOptions.experimentalResolveStyleCssClasses;
			return (setting === 'scoped' && style.scoped) || setting === 'always';
		});
		const htmlGen = computed(() => {

			if (!sfc.templateAst)
				return;

			return templateGen.generate(
				ts,
				{
					target: vueCompilerOptions.target ?? 3,
					strictTemplates: vueCompilerOptions.strictTemplates ?? false,
					experimentalRuntimeMode: vueCompilerOptions.experimentalRuntimeMode,
					experimentalAllowTypeNarrowingInInlineHandlers: vueCompilerOptions.experimentalAllowTypeNarrowingInInlineHandlers ?? false,
				},
				sfc.template?.lang ?? 'html',
				sfc.templateAst,
				!!sfc.scriptSetup,
				Object.values(cssScopedClasses.value).map(style => style.classNames).flat(),
				{
					getEmitCompletion: SearchTexts.EmitCompletion,
					getPropsCompletion: SearchTexts.PropsCompletion,
				}
			);
		});
		const tsxGen = computed(() => genScript(
			ts,
			fileName,
			lang.value,
			sfc.script ?? undefined,
			sfc.scriptSetup ?? undefined,
			scriptRanges.value,
			scriptSetupRanges.value,
			cssVars.value,
			cssModuleClasses.value,
			cssScopedClasses.value,
			htmlGen.value,
			vueCompilerOptions,
		));

		return {
			lang,
			htmlGen,
			tsxGen,
		};
	}
};
export default plugin;

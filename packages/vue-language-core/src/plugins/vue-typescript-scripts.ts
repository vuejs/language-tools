import { generate as genScript } from '../generators/script';
import type * as templateGen from '../generators/template';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { Ref } from '@vue/reactivity';
import { useCssVars, useStyleCssClasses, VueLanguagePlugin } from '../sourceFile';
import { VueCompilerOptions } from '../types';

export default function (
	ts: typeof import('typescript/lib/tsserverlibrary'),
	scriptRanges: Ref<ReturnType<typeof parseScriptRanges> | undefined>,
	scriptSetupRanges: Ref<ReturnType<typeof parseScriptSetupRanges> | undefined>,
	htmlGen: Ref<ReturnType<typeof templateGen.generate> | undefined>,
	compilerOptions: VueCompilerOptions,
	cssVars: ReturnType<typeof useCssVars>,
	cssModuleClasses: ReturnType<typeof useStyleCssClasses>,
	cssScopedClasses: ReturnType<typeof useStyleCssClasses>,
	disableTemplateScript: boolean,
): VueLanguagePlugin {

	return {

		getEmbeddedFileNames(fileName, sfc) {

			const fileNames: string[] = [];

			if (!fileName.endsWith('.html')) {
				let lang = !sfc.script && !sfc.scriptSetup ? 'ts'
					: sfc.scriptSetup && sfc.scriptSetup.lang !== 'js' ? sfc.scriptSetup.lang
						: sfc.script && sfc.script.lang !== 'js' ? sfc.script.lang
							: 'js';
				if (!disableTemplateScript) {
					if (lang === 'js') {
						lang = 'jsx';
					}
					else if (lang === 'ts') {
						lang = 'tsx';
					}
				}
				fileNames.push(fileName + '.' + lang);
			}
			if (sfc.template) {
				fileNames.push(fileName + '.__VLS_template_format.tsx');
				fileNames.push(fileName + '.__VLS_template.css');
			}

			return fileNames;
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {
			const suffix = embeddedFile.fileName.replace(fileName, '');
			const match = suffix.match(/^\.(js|ts|jsx|tsx)?$/);
			if (match) {
				const lang = match[1];
				embeddedFile.isTsHostFile = true;
				embeddedFile.capabilities = {
					diagnostics: true,
					foldingRanges: false,
					formatting: false,
					documentSymbol: false,
					codeActions: true,
					inlayHints: true,
				};
				genScript(
					ts,
					fileName,
					lang,
					sfc.script ?? undefined,
					sfc.scriptSetup ?? undefined,
					scriptRanges.value,
					scriptSetupRanges.value,
					cssVars.value,
					cssModuleClasses.value,
					cssScopedClasses.value,
					htmlGen.value,
					compilerOptions,
					embeddedFile.codeGen,
					embeddedFile.teleportMappings,
				);
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
				if (htmlGen.value) {
					embeddedFile.codeGen = htmlGen.value.formatCodeGen;
				}
			}
			else if (suffix.match(/^\.__VLS_template\.css$/)) {

				embeddedFile.parentFileName = fileName + '.' + sfc.template?.lang;
				if (htmlGen.value) {
					embeddedFile.codeGen = htmlGen.value.cssCodeGen;
				}
			}
		},
	};
}

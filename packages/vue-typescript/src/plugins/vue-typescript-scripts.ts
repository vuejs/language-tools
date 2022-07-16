import { generate as genScript } from '@volar/vue-code-gen/out/generators/script';
import type * as templateGen from '@volar/vue-code-gen/out/generators/template';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { Ref } from '@vue/reactivity';
import { VueCompilerOptions } from '../types';
import { EmbeddedFile, VueLanguagePlugin } from '../sourceFile';

export default function (
	lang: Ref<string>,
	scriptRanges: Ref<ReturnType<typeof parseScriptRanges> | undefined>,
	scriptSetupRanges: Ref<ReturnType<typeof parseScriptSetupRanges> | undefined>,
	htmlGen: Ref<ReturnType<typeof templateGen.generate> | undefined>,
	compilerOptions: VueCompilerOptions,
	cssVars: Ref<string[]>,
): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(fileName, sfc) {
			return fileName.endsWith('.html') ? 0 : 2;
		},

		getEmbeddedFile(fileName, sfc, i) {

			let shimComponentOptionsMode: 'defineComponent' | 'Vue.extend' | false = false;

			if (
				(compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent ?? 'onlyJs') === 'onlyJs'
					? lang.value === 'js' || lang.value === 'jsx'
					: !!compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent
			) {
				shimComponentOptionsMode = 'defineComponent';
			}
			if (
				(compilerOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend ?? 'onlyJs') === 'onlyJs'
					? lang.value === 'js' || lang.value === 'jsx'
					: !!compilerOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend
			) {
				shimComponentOptionsMode = 'Vue.extend';
			}

			// true override 'onlyJs'
			if (compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent === true) {
				shimComponentOptionsMode = 'defineComponent';
			}
			if (compilerOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend === true) {
				shimComponentOptionsMode = 'Vue.extend';
			}

			const codeGen = genScript(
				i === 0 ? 'script' : 'template',
				fileName,
				sfc.script ?? undefined,
				sfc.scriptSetup ?? undefined,
				scriptRanges.value,
				scriptSetupRanges.value,
				() => htmlGen.value,
				() => {
					const bindTexts: string[] = [];
					for (const cssVar of cssVars.value) {
						bindTexts.push(cssVar);
					}
					return bindTexts;
				},
				shimComponentOptionsMode,
				(compilerOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup ?? 'onlyJs') === 'onlyJs'
					? lang.value === 'js' || lang.value === 'jsx'
					: !!compilerOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup,
				compilerOptions.target ?? 3,
			);

			let file: EmbeddedFile | undefined;

			if (i === 0) {
				file = {
					fileName: fileName + '.' + lang.value,
					content: codeGen.codeGen.getText(),
					capabilities: {
						diagnostics: !sfc.script?.src,
						foldingRanges: false,
						formatting: false,
						documentSymbol: false,
						codeActions: !sfc.script?.src,
						inlayHints: !sfc.script?.src,
					},
					isTsHostFile: true,
					mappings: codeGen.codeGen.getMappings(),
					teleportMappings: codeGen.teleports,
				};
			}
			else if (sfc.script || sfc.scriptSetup) {
				file = {
					fileName: fileName + '.__VLS_script.' + lang.value,
					content: codeGen.codeGen.getText(),
					capabilities: {
						diagnostics: false,
						foldingRanges: false,
						formatting: false,
						documentSymbol: false,
						codeActions: false,
						inlayHints: false,
					},
					isTsHostFile: true,
					mappings: codeGen.codeGen.getMappings(),
					teleportMappings: codeGen.teleports,
				};
			}

			return file;
		},
	};
}

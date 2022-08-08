import { generate as genScript } from '@volar/vue-code-gen/out/generators/script';
import type * as templateGen from '@volar/vue-code-gen/out/generators/template';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { Ref } from '@vue/reactivity';
import { VueCompilerOptions } from '../types';
import { VueLanguagePlugin } from '../sourceFile';

export default function (
	lang: Ref<string>,
	scriptRanges: Ref<ReturnType<typeof parseScriptRanges> | undefined>,
	scriptSetupRanges: Ref<ReturnType<typeof parseScriptSetupRanges> | undefined>,
	htmlGen: Ref<ReturnType<typeof templateGen.generate> | undefined>,
	compilerOptions: VueCompilerOptions,
	cssVars: Ref<string[]>,
): VueLanguagePlugin {

	return {

		getEmbeddedFileNames(fileName, sfc) {
			if (!fileName.endsWith('.html')) {
				return [
					fileName + '.' + lang.value,
					fileName + '.__VLS_script.' + lang.value,
				];
			}
			return [];
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.replace(fileName, '').match(/^(\.__VLS_script)?\.(js|ts)x?$/);
			if (match) {
				embeddedFile.isTsHostFile = true;
				embeddedFile.capabilities = !match[1] ? {
					diagnostics: !sfc.script?.src,
					foldingRanges: false,
					formatting: false,
					documentSymbol: false,
					codeActions: !sfc.script?.src,
					inlayHints: !sfc.script?.src,
				} : {
					diagnostics: false,
					foldingRanges: false,
					formatting: false,
					documentSymbol: false,
					codeActions: false,
					inlayHints: false,
				};
				genScript(
					!match[1] ? 'script' : 'template',
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
					getShimComponentOptionsMode(),
					(compilerOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup ?? 'onlyJs') === 'onlyJs'
						? lang.value === 'js' || lang.value === 'jsx'
						: !!compilerOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup,
					compilerOptions.target ?? 3,
					embeddedFile.codeGen,
					embeddedFile.teleportMappings,
				);
			}
		},
	};

	function getShimComponentOptionsMode() {

		let shimComponentOptionsMode: 'defineComponent' | 'Vue.extend' | false = false;

		if (
			(compilerOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend ?? 'onlyJs') === 'onlyJs'
				? lang.value === 'js' || lang.value === 'jsx'
				: !!compilerOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend
		) {
			shimComponentOptionsMode = 'Vue.extend';
		}
		if (
			(compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent ?? 'onlyJs') === 'onlyJs'
				? lang.value === 'js' || lang.value === 'jsx'
				: !!compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent
		) {
			shimComponentOptionsMode = 'defineComponent';
		}

		// true override 'onlyJs'
		if (compilerOptions.experimentalImplicitWrapComponentOptionsWithVue2Extend === true) {
			shimComponentOptionsMode = 'Vue.extend';
		}
		if (compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent === true) {
			shimComponentOptionsMode = 'defineComponent';
		}

		return shimComponentOptionsMode;
	}
}

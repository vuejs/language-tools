import { Embedded, EmbeddedFile } from '../vueFile';
import { generate as genScript } from '@volar/vue-code-gen/out/generators/script';
import type * as templateGen from '@volar/vue-code-gen/out/generators/template';
import { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { Ref } from '@vue/reactivity';
import { VueCompilerOptions } from '../types';
import { VueLanguagePlugin } from '../vueFile';
import { EmbeddedFileSourceMap, Teleport } from '../utils/sourceMaps';

export default function (
	lang: Ref<string>,
	scriptRanges: Ref<ReturnType<typeof parseScriptRanges> | undefined>,
	scriptSetupRanges: Ref<ReturnType<typeof parseScriptSetupRanges> | undefined>,
	htmlGen: Ref<ReturnType<typeof templateGen.generate> | undefined>,
	compilerOptions: VueCompilerOptions,
	cssVars: Ref<string[]>,
): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(sfc) {
			return 2;
		},

		getEmbeddedFile(fileName, sfc, i) {

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
				(compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent ?? 'onlyJs') === 'onlyJs'
					? lang.value === 'js' || lang.value === 'jsx'
					: !!compilerOptions.experimentalImplicitWrapComponentOptionsWithDefineComponent,
				(compilerOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup ?? 'onlyJs') === 'onlyJs'
					? lang.value === 'js' || lang.value === 'jsx'
					: !!compilerOptions.experimentalDowngradePropsAndEmitsToSetupReturnOnScriptSetup,
				compilerOptions.experimentalCompatMode ?? 3,
			);

			let file: EmbeddedFile | undefined;

			if (i === 0) {
				file = {
					fileName: fileName + '.' + lang.value,
					lang: lang.value,
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
				};
			}
			else if (sfc.script || sfc.scriptSetup) {
				file = {
					fileName: fileName + '.__VLS_script.' + lang.value,
					lang: lang.value,
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
				};
			}

			if (!file)
				return;

			const embedded: Embedded = {
				file,
				sourceMap: new EmbeddedFileSourceMap(codeGen.codeGen.getMappings()),
				teleport: new Teleport(codeGen.teleports),
			};

			return embedded;
		},
	};
}

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { computed, Ref, ComputedRef } from '@vue/reactivity';
import { EmbeddedDocumentSourceMap, TeleportSourceMap, EmbeddedDocumentMappingData, Range, getEmbeddedDocumentSourceMapId } from '../utils/sourceMaps';
import { generate as genScript } from '@volar/vue-code-gen/out/generators/script';
import * as templateGen from '@volar/vue-code-gen/out/generators/template_scriptSetup';
import type { parseScriptRanges } from '@volar/vue-code-gen/out/parsers/scriptRanges';
import type { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { getVueLibraryName } from '../utils/localTypes';
import type { BasicRuntimeContext } from '../types';

export function useSfcScriptGen<T extends 'template' | 'script'>(
	lsType: T,
	vueUri: string,
	vueDoc: Ref<TextDocument>,
	script: Ref<shared.Sfc['script']>,
	scriptSetup: Ref<shared.Sfc['scriptSetup']>,
	scriptRanges: Ref<ReturnType<typeof parseScriptRanges> | undefined>,
	scriptSetupRanges: Ref<ReturnType<typeof parseScriptSetupRanges> | undefined>,
	sfcTemplateCompileResult: ReturnType<(typeof import('./useSfcTemplateCompileResult'))['useSfcTemplateCompileResult']>,
	sfcStyles: ReturnType<(typeof import('./useSfcStyles'))['useSfcStyles']>['textDocuments'],
	isVue2: boolean,
	getCssVBindRanges: BasicRuntimeContext['getCssVBindRanges'],
) {

	let lastDocumentText = '';
	let version = 0;

	const htmlGen = computed(() => {
		if (sfcTemplateCompileResult.value?.ast) {
			return templateGen.generate(sfcTemplateCompileResult.value.ast);
		}
	});
	const codeGen = computed(() =>
		genScript(
			lsType,
			vueUri,
			script.value ?? undefined,
			scriptSetup.value ?? undefined,
			scriptRanges.value,
			scriptSetupRanges.value,
			() => htmlGen.value,
			() => {
				const bindTexts: string[] = [];
				for (const style of sfcStyles.value) {
					const binds = getCssVBindRanges(style.textDocument);
					const docText = style.textDocument.getText();
					for (const cssBind of binds) {
						const bindText = docText.substring(cssBind.start, cssBind.end);
						bindTexts.push(bindText);
					}
				}
				return bindTexts;
			},
			getVueLibraryName(isVue2),
		)
	);
	const lang = computed(() => {
		return !script.value && !scriptSetup.value ? 'ts'
			: scriptSetup.value && scriptSetup.value.lang !== 'js' ? scriptSetup.value.lang
				: script.value && script.value.lang !== 'js' ? script.value.lang
					: 'js'
	});
	const textDocument = computed(() => {

		const nowText = codeGen.value.codeGen.getText();
		const nowVersion = nowText === lastDocumentText ? version : ++version;
		lastDocumentText = nowText;

		if (lsType === 'script') {
			return TextDocument.create(
				`${vueUri}.${lang.value}`,
				shared.syntaxToLanguageId(lang.value),
				nowVersion,
				nowText,
			);
		}
		else if (script.value || scriptSetup.value) {
			return TextDocument.create(
				`${vueUri}.__VLS_script.${lang.value}`,
				shared.syntaxToLanguageId(lang.value),
				nowVersion,
				nowText,
			);
		}
	});
	const textDocumentTs = computed(() => {
		if (lsType === 'template' && textDocument.value && ['js', 'jsx'].includes(lang.value)) {
			const tsLang = lang.value === 'jsx' ? 'tsx' : 'ts';
			return TextDocument.create(
				`${vueUri}.__VLS_script_ts.${tsLang}`,
				shared.syntaxToLanguageId(tsLang),
				textDocument.value.version,
				textDocument.value.getText(),
			);
		}
	});
	const sourceMapId = getEmbeddedDocumentSourceMapId();
	const sourceMap = computed(() => {
		if (textDocument.value) {
			const sourceMap = new EmbeddedDocumentSourceMap(
				sourceMapId,
				vueDoc.value,
				textDocument.value,
				lsType,
				{
					diagnostics: !script.value?.src && lsType === 'script',
					foldingRanges: false,
					formatting: false,
					documentSymbol: false,
					codeActions: !script.value?.src && lsType === 'script',
				},
				codeGen.value.codeGen.getMappings(parseMappingSourceRange),
			);

			return sourceMap;
		}
	});
	const teleportSourceMap = computed(() => {
		if (textDocument.value) {
			const sourceMap = new TeleportSourceMap(textDocument.value);
			for (const teleport of codeGen.value.teleports) {
				sourceMap.mappings.push(teleport);
			}

			return sourceMap;
		}
	});

	return {
		lang,
		textDocument: textDocument as T extends 'script' ? ComputedRef<TextDocument> : ComputedRef<TextDocument | undefined>,
		textDocumentTs,
		sourceMap: sourceMap as T extends 'script' ? ComputedRef<EmbeddedDocumentSourceMap> : ComputedRef<EmbeddedDocumentSourceMap | undefined>,
		teleportSourceMap: teleportSourceMap as T extends 'script' ? ComputedRef<TeleportSourceMap> : ComputedRef<TeleportSourceMap | undefined>,
	};

	function parseMappingSourceRange(data: EmbeddedDocumentMappingData, sourceRange: Range) {
		if (data.vueTag === 'scriptSrc' && script.value?.src) {
			const vueStart = vueDoc.value.getText().substring(0, script.value.startTagEnd).lastIndexOf(script.value.src);
			const vueEnd = vueStart + script.value.src.length;
			return {
				start: vueStart - 1,
				end: vueEnd + 1,
			};
		}
		else if (data.vueTag === 'script' && script.value) {
			return {
				start: script.value.startTagEnd + sourceRange.start,
				end: script.value.startTagEnd + sourceRange.end,
			};
		}
		else if (data.vueTag === 'scriptSetup' && scriptSetup.value) {
			return {
				start: scriptSetup.value.startTagEnd + sourceRange.start,
				end: scriptSetup.value.startTagEnd + sourceRange.end,
			};
		}
		else {
			return sourceRange;
		}
	}
}

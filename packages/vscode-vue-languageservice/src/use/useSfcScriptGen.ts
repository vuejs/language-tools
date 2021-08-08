import type { IDescriptor } from '../types';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { TsSourceMap, TeleportSourceMap, TsMappingData, Range } from '../utils/sourceMaps';
import { parseScriptRanges } from '../parsers/scriptRanges';
import { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';
import { generate as genScript } from '../generators/script';
import { generate as genScriptSuggestion } from '../generators/script_suggestion';
import * as templateGen from '../generators/template_scriptSetup';

export function useSfcScriptGen(
	lsType: 'template' | 'script',
	ts: typeof import('typescript/lib/tsserverlibrary'),
	vueDoc: Ref<TextDocument>,
	script: Ref<IDescriptor['script']>,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
	sfcTemplateCompileResult: ReturnType<(typeof import('./useSfcTemplateCompileResult'))['useSfcTemplateCompileResult']>,
) {

	let version = 0;
	const uri = vueDoc.value.uri;

	const scriptRanges = computed(() =>
		script.value
			? parseScriptRanges(ts, script.value.content, script.value.lang, !!scriptSetup.value)
			: undefined
	);
	const scriptSetupRanges = computed(() =>
		scriptSetup.value
			? parseScriptSetupRanges(ts, scriptSetup.value.content, scriptSetup.value.lang)
			: undefined
	);
	const codeGen = computed(() =>
		genScript(
			lsType,
			uri,
			script.value,
			scriptSetup.value,
			scriptRanges.value,
			scriptSetupRanges.value,
		)
	);
	const htmlGen = computed(() => {
		if (sfcTemplateCompileResult.value?.ast) {
			return templateGen.generate(sfcTemplateCompileResult.value.ast);
		}
	})
	const suggestionCodeGen = computed(() =>
		genScriptSuggestion(
			script.value,
			scriptSetup.value,
			scriptRanges.value,
			scriptSetupRanges.value,
			htmlGen.value,
		)
	);
	const lang = computed(() => {
		return !script.value && !scriptSetup.value ? 'ts'
			: scriptSetup.value && scriptSetup.value.lang !== 'js' ? shared.getValidScriptSyntax(scriptSetup.value.lang)
				: script.value && script.value.lang !== 'js' ? shared.getValidScriptSyntax(script.value.lang)
					: 'js'
	});
	const textDocument = computed(() => {
		return TextDocument.create(
			lsType === 'template' ? `${uri}.__VLS_script.${lang.value}` : `${uri}.${lang.value}`,
			shared.syntaxToLanguageId(lang.value),
			version++,
			codeGen.value.getText(),
		);
	});
	const textDocumentForSuggestion = computed(() => {
		if (!suggestionCodeGen.value)
			return;

		return TextDocument.create(
			`${uri}.__VLS_script.suggestion.${lang.value}`,
			shared.syntaxToLanguageId(lang.value),
			version++,
			suggestionCodeGen.value.getText(),
		);
	});
	const sourceMap = computed(() => {
		const sourceMap = new TsSourceMap(
			vueDoc.value,
			textDocument.value,
			lsType,
			false,
			{
				foldingRanges: false,
				formatting: false,
				documentSymbol: true,
				codeActions: true,
				organizeImports: !script.value?.src && !scriptSetup.value,
			},
			codeGen.value.getMappings(parseMappingSourceRange),
		);

		return sourceMap;
	});
	const sourceMapForSuggestion = computed(() => {
		if (!suggestionCodeGen.value)
			return;
		if (!textDocumentForSuggestion.value)
			return;

		const sourceMap = new TsSourceMap(
			vueDoc.value,
			textDocumentForSuggestion.value,
			lsType,
			false,
			{
				foldingRanges: false,
				formatting: false,
				documentSymbol: false,
				codeActions: true,
				organizeImports: true,
			},
			suggestionCodeGen.value.getMappings(parseMappingSourceRange),
		);

		return sourceMap;
	});
	const teleportSourceMap = computed(() => {
		const doc = textDocument.value;
		const sourceMap = new TeleportSourceMap(doc, false);
		for (const teleport of codeGen.value.teleports) {
			sourceMap.add(teleport);
		}

		return sourceMap;
	});

	return {
		lang,
		scriptSetupRanges,
		textDocument,
		textDocumentForSuggestion,
		sourceMap,
		sourceMapForSuggestion,
		teleportSourceMap,
	};

	function parseMappingSourceRange(data: TsMappingData, sourceRange: Range) {
		if (data.vueTag === 'scriptSrc' && script.value?.src) {
			const vueStart = vueDoc.value.getText().substring(0, script.value.loc.start).lastIndexOf(script.value.src);
			const vueEnd = vueStart + script.value.src.length;
			return {
				start: vueStart - 1,
				end: vueEnd + 1,
			};
		}
		else if (data.vueTag === 'script' && script.value) {
			return {
				start: script.value.loc.start + sourceRange.start,
				end: script.value.loc.start + sourceRange.end,
			};
		}
		else if (data.vueTag === 'scriptSetup' && scriptSetup.value) {
			return {
				start: scriptSetup.value.loc.start + sourceRange.start,
				end: scriptSetup.value.loc.start + sourceRange.end,
			};
		}
		else {
			return sourceRange;
		}
	}
}

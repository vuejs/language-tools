import type { IDescriptor } from '../types';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId, getValidScriptSyntax } from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { TsSourceMap, TeleportSourceMap, TsMappingData, Range } from '../utils/sourceMaps';
import { parse as parseScriptAst } from '../parsers/scriptAst';
import { parse as parseScriptSetupAst } from '../parsers/scriptSetupAst';
import { generate as genScript } from '../generators/script';
import { generate as genScriptSuggestion } from '../generators/script_suggestion';
import * as templateGen from '../generators/template_scriptSetup';

export function useScriptSetupGen(
	ts: typeof import('typescript'),
	vueDoc: Ref<TextDocument>,
	script: Ref<IDescriptor['script']>,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
	html: Ref<string | undefined>,
) {

	let version = 0;
	const uri = vueDoc.value.uri;

	const scriptAst = computed(() =>
		script.value
			? parseScriptAst(ts, script.value.content, script.value.lang)
			: undefined
	);
	const scriptSetupAst = computed(() =>
		scriptSetup.value
			? parseScriptSetupAst(ts, scriptSetup.value.content, scriptSetup.value.lang)
			: undefined
	);
	const codeGen = computed(() =>
		genScript(
			uri,
			script.value,
			scriptSetup.value,
			scriptAst.value,
			scriptSetupAst.value,
		)
	);
	const htmlGen = computed(() => {
		if (html.value) {
			return templateGen.generate(html.value);
		}
	})
	const suggestionCodeGen = computed(() =>
		genScriptSuggestion(
			script.value,
			scriptSetup.value,
			scriptSetupAst.value,
			htmlGen.value,
		)
	);
	const lang = computed(() => {
		return scriptSetup.value && scriptSetup.value.lang !== 'js' ? getValidScriptSyntax(scriptSetup.value.lang) :
			script.value && script.value.lang !== 'js' ? getValidScriptSyntax(script.value.lang) :
				getValidScriptSyntax('js')
	});
	const textDocument = computed(() => {
		if (!codeGen.value)
			return;

		return TextDocument.create(
			`${uri}.__VLS_script.${lang.value}`,
			syntaxToLanguageId(lang.value),
			version++,
			codeGen.value.getText(),
		);
	});
	const textDocumentForSuggestion = computed(() => {
		if (!suggestionCodeGen.value)
			return;

		return TextDocument.create(
			`${uri}.__VLS_script.suggestion.${lang.value}`,
			syntaxToLanguageId(lang.value),
			version++,
			suggestionCodeGen.value.getText(),
		);
	});
	const textDocumentForTemplate = computed(() => {
		if (!textDocument.value)
			return;
		if (textDocument.value.languageId !== 'javascript')
			return;

		const lang = 'ts';

		return TextDocument.create(
			`${uri}.__VLS_script.${lang}`,
			syntaxToLanguageId(lang),
			textDocument.value.version,
			textDocument.value.getText(),
		);
	});
	const sourceMap = computed(() => {
		if (!codeGen.value)
			return;
		if (!textDocument.value)
			return;

		const sourceMap = new TsSourceMap(
			vueDoc.value,
			textDocument.value,
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
	const sourceMapForTemplate = computed(() => {
		if (!textDocumentForTemplate.value)
			return;
		if (!sourceMap.value)
			return;

		const newSourceMap = new TsSourceMap(
			sourceMap.value.sourceDocument,
			textDocumentForTemplate.value,
			sourceMap.value.isInterpolation,
			{
				foldingRanges: false,
				formatting: false,
				documentSymbol: false,
				codeActions: false,
				organizeImports: false,
			},
		);

		for (const maped of sourceMap.value) {
			newSourceMap.add({
				...maped,
				data: {
					...maped.data,
					capabilities: {
						references: maped.data.capabilities.references,
						definitions: maped.data.capabilities.definitions,
						rename: maped.data.capabilities.rename,
						referencesCodeLens: maped.data.capabilities.referencesCodeLens,
					},
				},
			})
		}

		return newSourceMap;
	});
	const teleportSourceMap = computed(() => {
		const doc = textDocumentForTemplate.value ?? textDocument.value;
		if (!doc)
			return;
		if (!codeGen.value)
			return;

		const sourceMap = new TeleportSourceMap(doc);
		for (const teleport of codeGen.value.teleports) {
			sourceMap.add(teleport);
		}

		return sourceMap;
	});

	return {
		scriptSetupAst,
		textDocument,
		textDocumentForSuggestion,
		textDocumentForTemplate,
		sourceMap,
		sourceMapForSuggestion,
		sourceMapForTemplate,
		teleportSourceMap,
	};

	function parseMappingSourceRange(data: TsMappingData, sourceRange: Range) {
		if (data.vueTag === 'scriptSrc' && script.value?.src) {
			const vueStart = script.value.content.length
				? vueDoc.value.getText().substring(0, script.value.loc.start).lastIndexOf(script.value.src)
				: (vueDoc.value.getText().substring(script.value.loc.start).indexOf(script.value.src) + script.value.loc.start); // TODO: don't use indexOf()
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

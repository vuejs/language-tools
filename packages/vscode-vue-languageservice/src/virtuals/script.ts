import type { IDescriptor } from '../types';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId, getValidScriptSyntax } from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { TsSourceMap, TeleportSourceMap } from '../utils/sourceMaps';
import { parse as parseScriptAst } from '../parsers/scriptAst';
import { parse as parseScriptSetupAst } from '../parsers/scriptSetupAst';
import { generate as genScript } from '../generators/script';
import { generate as genScriptSugg } from '../generators/script_suggestion';
import * as templateGen from '../generators/template';

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
			? parseScriptAst(ts, script.value.content)
			: undefined
	);
	const scriptSetupAst = computed(() =>
		scriptSetup.value
			? parseScriptSetupAst(ts, scriptSetup.value.content)
			: undefined
	);
	const generate = computed(() =>
		genScript(
			script.value,
			scriptSetup.value,
			scriptAst.value,
			scriptSetupAst.value,
		)
	);
	const htmlGen = computed(() => {
		if (html.value) {
			return templateGen.generate(html.value, [], [], [], undefined, false);
		}
	})
	const generateForSuggestion = computed(() =>
		genScriptSugg(
			script.value,
			scriptSetup.value,
			scriptSetupAst.value,
			htmlGen.value,
		)
	);
	const textDocument = computed(() => {
		if (!generate.value)
			return;

		const lang = scriptSetup.value && scriptSetup.value.lang !== 'js' ? getValidScriptSyntax(scriptSetup.value.lang) :
			script.value && script.value.lang !== 'js' ? getValidScriptSyntax(script.value.lang) :
				getValidScriptSyntax('js')

		return TextDocument.create(
			`${uri}.__VLS_script.${lang}`,
			syntaxToLanguageId(lang),
			version++,
			generate.value.code,
		);
	});
	const textDocumentForSuggestion = computed(() => {
		if (!generateForSuggestion.value)
			return;

		const lang = scriptSetup.value && scriptSetup.value.lang !== 'js' ? getValidScriptSyntax(scriptSetup.value.lang)
			: script.value && script.value.lang !== 'js' ? getValidScriptSyntax(script.value.lang)
				: getValidScriptSyntax('js')

		return TextDocument.create(
			`${uri}.__VLS_script.suggestion.${lang}`,
			syntaxToLanguageId(lang),
			version++,
			generateForSuggestion.value.code,
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
		if (!generate.value)
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
		);

		for (const mapping of generate.value.mappings) {
			if (mapping.data.vueTag === 'scriptSrc' && script.value?.src) {
				const vueStart = script.value.content.length
					? vueDoc.value.getText().substring(0, script.value.loc.start).lastIndexOf(script.value.src)
					: (vueDoc.value.getText().substring(script.value.loc.start).indexOf(script.value.src) + script.value.loc.start); // TODO: don't use indexOf()
				const vueEnd = vueStart + script.value.src.length;
				sourceMap.add({
					...mapping,
					sourceRange: {
						start: vueStart - 1,
						end: vueEnd + 1,
					},
				});
			}
			else if (mapping.data.vueTag === 'script' && script.value) {
				sourceMap.add({
					...mapping,
					sourceRange: {
						start: script.value.loc.start + mapping.sourceRange.start,
						end: script.value.loc.start + mapping.sourceRange.end,
					},
				});
			}
			else if (mapping.data.vueTag === 'scriptSetup' && scriptSetup.value) {
				sourceMap.add({
					...mapping,
					sourceRange: {
						start: scriptSetup.value.loc.start + mapping.sourceRange.start,
						end: scriptSetup.value.loc.start + mapping.sourceRange.end,
					},
				});
			}
		}

		return sourceMap;
	});
	const sourceMapForSuggestion = computed(() => {
		if (!generateForSuggestion.value)
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
		);

		for (const mapping of generateForSuggestion.value.mappings) {
			if (mapping.data.vueTag === 'script' && script.value) {
				sourceMap.add({
					...mapping,
					sourceRange: {
						start: script.value.loc.start + mapping.sourceRange.start,
						end: script.value.loc.start + mapping.sourceRange.end,
					},
				});
			}
			else if (mapping.data.vueTag === 'scriptSetup' && scriptSetup.value) {
				sourceMap.add({
					...mapping,
					sourceRange: {
						start: scriptSetup.value.loc.start + mapping.sourceRange.start,
						end: scriptSetup.value.loc.start + mapping.sourceRange.end,
					},
				});
			}
		}

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
		if (!generate.value)
			return;

		const sourceMap = new TeleportSourceMap(doc);
		for (const teleport of generate.value.teleports) {
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
}

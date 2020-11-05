import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId } from '@volar/shared';
import * as upath from 'upath';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, TsSourceMap } from '../utils/sourceMaps';

export function useScriptSetupGen(
	getUnreactiveDoc: () => TextDocument,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
	declares: Ref<Map<string, {
		start: number;
		end: number;
	}>>
) {
	let version = 0;
	const textDocument = computed(() => {
		if (scriptSetup.value) {
			const vueDoc = getUnreactiveDoc();
			const lang = scriptSetup.value.lang; // TODO: js
			const uri = `${vueDoc.uri}.script.setup.gen.${lang}`;
			const languageId = syntaxToLanguageId(lang);
			const setup = scriptSetup.value.setup;
			let content = '';
			let start = 0;
			const locs = [...declares.value.values()].sort((a, b) => a.start - b.start);
			for (const loc of locs) {
				content += scriptSetup.value.content.substring(start, loc.start);
				content += ' '.repeat(loc.end - loc.start);
				start = loc.end;
			}
			content += scriptSetup.value.content.substring(start);
			content += [
				``,
				`declare const __VLS_options: typeof import('./${upath.basename(vueDoc.uri)}.script.setup.raw').default;`,
				`declare const __VLS_parameters: Parameters<NonNullable<typeof __VLS_options.setup>>;`,
				`declare var [${setup}]: typeof __VLS_parameters;`,
			].join('\n');
			return TextDocument.create(uri, languageId, version++, content);
		}
	});
	const sourceMap = computed(() => {
		if (textDocument.value && scriptSetup.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new TsSourceMap(vueDoc, textDocument.value, false, { foldingRanges: true });
			{
				const vueStart = scriptSetup.value.loc.start;
				const vueEnd = scriptSetup.value.loc.end;
				const virtualRanges: { start: number, end: number }[] = [];
				let start = 0;
				const locs = [...declares.value.values()].sort((a, b) => a.start - b.start);
				for (const loc of locs) {
					virtualRanges.push({ start: start, end: loc.start });
					start = loc.end;
				}
				virtualRanges.push({ start: start, end: vueEnd - vueStart });
				for (const virtualRange of virtualRanges) {
					sourceMap.add({
						data: {
							vueTag: 'script',
							capabilities: {
								basic: true,
								references: true,
								rename: true,
								diagnostic: true,
								formatting: true,
								completion: true,
								semanticTokens: true,
							},
						},
						mode: MapedMode.Offset,
						sourceRange: {
							start: vueStart + virtualRange.start,
							end: vueStart + virtualRange.end,
						},
						targetRange: {
							start: virtualRange.start,
							end: virtualRange.end,
						},
					});
				}
			}
			{
				const setup = scriptSetup.value.setup;
				const start = vueDoc.getText().substring(0, scriptSetup.value.loc.start).lastIndexOf(setup); // TODO: don't use indexOf()
				const end = start + setup.length;
				const start_2 = textDocument.value.getText().lastIndexOf(`${setup}]: typeof __VLS_parameters;`);
				const end_2 = start_2 + setup.length;
				sourceMap.add({
					data: {
						vueTag: 'script',
						capabilities: {
							basic: true,
							references: true,
							rename: true,
							diagnostic: true,
							formatting: true,
							completion: true,
							semanticTokens: true,
						},
					},
					mode: MapedMode.Offset,
					sourceRange: {
						start: start,
						end: end,
					},
					targetRange: {
						start: start_2,
						end: end_2,
					},
				});
			}
			return sourceMap;
		}
	});
	return {
		textDocument,
		sourceMap,
	};
}

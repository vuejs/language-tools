import { TextDocument } from 'vscode-languageserver-textdocument';
import { syntaxToLanguageId } from '@volar/shared';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, TsSourceMap } from '../utils/sourceMaps';
import * as ts from 'typescript';

export function useScriptSetupRaw(
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
			const uri = `${vueDoc.uri}.script.setup.raw.${lang}`;
			const languageId = syntaxToLanguageId(lang);
			const hasDefaultExport = hasExportDefault(scriptSetup.value.content);
			let content = scriptSetup.value.content;
			if (!hasDefaultExport) {
				content += [
					``,
					declares.value.has('props') ? `// has props` : `declare const props: {};`,
					declares.value.has('emits') ? `// has emits` : `declare const emits: {};`, // TODO
					`declare const __VLS_defineComponent: (typeof import('@vue/runtime-dom'))['defineComponent'];`,
					`const __VLS_options = __VLS_defineComponent({ setup: () => { } });`,
					`declare const __VLS_parameters: Parameters<NonNullable<typeof __VLS_options.setup>>;`,
					`declare function __VLS_setup(__VLS_props: typeof props, __VLS_ctx: typeof __VLS_parameters[1]): ReturnType<NonNullable<typeof __VLS_options.setup>>;`,
					`declare const __VLS_export: typeof __VLS_options & {`,
					`	setup: typeof __VLS_setup,`,
					`	new(): InstanceType<typeof __VLS_options> & typeof props,`,
					`}`,
					`export default __VLS_export;`,
				].join('\n');
			}
			else {
				content += [
					``,
					`// has default export`,
				].join('\n');
			}
			return TextDocument.create(uri, languageId, version++, content);

			function hasExportDefault(code: string) {
				const sourceFile = ts.createSourceFile('', code, ts.ScriptTarget.Latest);
				let result = false;
				sourceFile.forEachChild(node => {
					if (ts.isExportAssignment(node)) {
						result = true;
					}
				});
				return result;
			}
		}
	});
	const sourceMap = computed(() => {
		if (textDocument.value && scriptSetup.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new TsSourceMap(vueDoc, textDocument.value, false, { foldingRanges: true });
			{
				for (const [dec, loc] of declares.value) {
					const vueStart = scriptSetup.value.loc.start;
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
							start: vueStart + loc.start,
							end: vueStart + loc.end,
						},
						targetRange: loc,
					});
				}
			}
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
								basic: false,
								references: true,
								rename: true,
								diagnostic: false,
								formatting: false,
								completion: false,
								semanticTokens: false,
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
			return sourceMap;
		}
	});
	return {
		textDocument,
		sourceMap,
	};
}

import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, TsSourceMap } from '../utils/sourceMaps';
import * as upath from 'upath';
import { SearchTexts } from './common';

export function useScriptMain(
	getUnreactiveDoc: () => TextDocument,
	script: Ref<IDescriptor['script']>,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
) {
	let version = 0;
	const optionsPropertyName = '__VLS_options';
	const exportVarName = '__VLS_exportData';
	const textDocument = computed(() => {
		const vueDoc = getUnreactiveDoc();
		const uri = `${vueDoc.uri}.ts`;
		const content = [
			`import { defineComponent as __VLS_defineComponent } from '@vue/runtime-dom';`,
			`import __VLS_VM from './${upath.basename(vueDoc.uri)}.${scriptSetup.value ? 'scriptSetup' : 'script'}';`,
			`import __VLS_Options from './${upath.basename(vueDoc.uri)}.options';`,
			`import __VLS_Slots from './${upath.basename(vueDoc.uri)}.template';`,
			`import * as __VLS_Setup from './${upath.basename(vueDoc.uri)}.scriptSetup';`,
			`const __VLS_comp2 = __VLS_defineComponent(__VLS_VM);`,
			`type __VLS_ComponentType<T> = T extends new (...args: any) => any ? T : typeof __VLS_comp2;`,
			`declare var __VLS_Component: __VLS_ComponentType<typeof __VLS_VM>;`,
			`declare var __VLS_ctx: InstanceType<typeof __VLS_Component>;`,
			`declare var __VLS_ComponentsWrap: typeof __VLS_Options & { components: { } };`,
			`declare var __VLS_Components: typeof __VLS_ComponentsWrap.components & __VLS_GlobalComponents;`,
			`__VLS_ctx.${SearchTexts.Context};`,
			`__VLS_Components.${SearchTexts.Components};`,
			`__VLS_Options.setup().${SearchTexts.SetupReturns};`,
			`__VLS_Options.props.${SearchTexts.Props};`,
			`__VLS_Setup.${SearchTexts.ScriptSetupExports};`,
			`({} as JSX.IntrinsicElements).${SearchTexts.HtmlElements};`,
			``,
			`declare global {`,
			`interface __VLS_GlobalComponents extends Pick<typeof import('@vue/runtime-dom'),`,
			`	'Transition'`,
			`	| 'TransitionGroup'`,
			`	| 'KeepAlive'`,
			`	| 'Suspense'`,
			`	| 'Teleport'`,
			`	> { }`,
			`}`,
			``,
			`declare const ${exportVarName}: typeof __VLS_Component & {`,
			`${optionsPropertyName}: typeof __VLS_Options,`,
			`__VLS_slots: typeof __VLS_Slots,`,
			`};`,
			`export * from './${upath.basename(vueDoc.uri)}.script';`,
			`export default ${exportVarName};`,
		].join('\n');
		return TextDocument.create(uri, 'typescript', version++, content);
	});
	const sourceMap = computed(() => {
		if (textDocument.value) {
			const vueDoc = getUnreactiveDoc();
			const docText = textDocument.value.getText();
			const rangesToSourceFullScript = [{
				start: 0,
				end: docText.length,
			}];
			const optionsPropertyOffset = docText.indexOf(optionsPropertyName);
			if (optionsPropertyOffset >= 0) {
				rangesToSourceFullScript.push({
					start: optionsPropertyOffset,
					end: optionsPropertyOffset + optionsPropertyName.length,
				});
			}
			const exportVarOffset = docText.indexOf(exportVarName);
			if (exportVarOffset >= 0) {
				rangesToSourceFullScript.push({
					start: exportVarOffset,
					end: exportVarOffset + exportVarName.length,
				});
			}
			const sourceMap = new TsSourceMap(vueDoc, textDocument.value, false, { foldingRanges: false, formatting: false });
			for (const range of rangesToSourceFullScript) {
				sourceMap.add({
					data: {
						vueTag: 'script',
						capabilities: {
							basic: false,
							references: false,
							rename: false,
							diagnostic: false,
							formatting: false,
							completion: false,
							semanticTokens: false,
						},
					},
					mode: MapedMode.Gate,
					sourceRange: {
						start: (scriptSetup.value ?? script.value)?.loc.start ?? 0,
						end: (scriptSetup.value ?? script.value)?.loc.end ?? 0,
					},
					targetRange: range,
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

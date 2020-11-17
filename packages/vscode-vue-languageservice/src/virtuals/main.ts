import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import { MapedMode, TsSourceMap } from '../utils/sourceMaps';
import * as upath from 'upath';
import { SearchTexts } from './common';
import { rfc } from './script';

export function useScriptMain(
	getUnreactiveDoc: () => TextDocument,
	script: Ref<IDescriptor['script']>,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
	template: Ref<IDescriptor['template']>,
) {
	let version = 0;
	const optionsPropertyName = '__VLS_options';
	const exportVarName = '__VLS_exportData';
	const textDocument = computed(() => {
		const vueDoc = getUnreactiveDoc();
		const uri = `${vueDoc.uri}.ts`;
		const hasScript = !!script.value || !!scriptSetup.value;
		const hasScriptSetupExports = rfc === '#182' && !!scriptSetup.value;
		const content = [
			`import { defineComponent } from '@vue/runtime-dom';`,
			hasScript ? `import __VLS_componentRaw from './${upath.basename(vueDoc.uri)}.script';` : `// no script`,
			hasScriptSetupExports ? `import * as __VLS_Setup from './${upath.basename(vueDoc.uri)}.scriptSetup.raw';` : `// no scriptSetup #182`,
			hasScript ? `import { __VLS_options } from './${upath.basename(vueDoc.uri)}.script';` : `var __VLS_options = {};`,
			...(hasScript
				? [`const __VLS_componentReserve = defineComponent(__VLS_componentRaw);`,
					`type __VLS_ComponentType<T> = T extends new (...args: any) => any ? T : typeof __VLS_componentReserve;`,
					`declare var __VLS_component: __VLS_ComponentType<typeof __VLS_componentRaw>;`,
					`declare var __VLS_ctx: InstanceType<typeof __VLS_component>;`]
				: [`var __VLS_component = defineComponent({});`]),
			`declare var __VLS_ComponentsWrap: typeof __VLS_options & { components: { } };`,
			`declare var __VLS_Components: typeof __VLS_ComponentsWrap.components & __VLS_GlobalComponents;`,
			hasScript ? `__VLS_ctx.${SearchTexts.Context};` : `// no script`,
			`__VLS_Components.${SearchTexts.Components};`,
			`__VLS_options.setup().${SearchTexts.SetupReturns};`,
			`__VLS_options.props.${SearchTexts.Props};`,
			hasScriptSetupExports ? `__VLS_Setup.${SearchTexts.ScriptSetupExports};` : `// no scriptSetup #182`,
			``,
			`declare const ${exportVarName}: typeof __VLS_component & {`,
			`${optionsPropertyName}: typeof __VLS_options,`,
			template.value ? `__VLS_slots: typeof import ('./${upath.basename(vueDoc.uri)}.template').default,` : `// no template`,
			`};`,
			hasScript ? `export * from './${upath.basename(vueDoc.uri)}.script';` : `// no script`,
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
						vueTag: '',
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

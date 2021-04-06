import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import * as SourceMaps from '../utils/sourceMaps';
import * as upath from 'upath';
import { SearchTexts } from '../utils/string';
import { uriToFsPath } from '@volar/shared';

export function useScriptMain(
	getUnreactiveDoc: () => TextDocument,
	script: Ref<IDescriptor['script']>,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
	template: Ref<IDescriptor['template']>,
) {
	let version = 0;
	const textDocument = computed(() => {
		const vueDoc = getUnreactiveDoc();
		const uri = `${vueDoc.uri}.ts`;
		const vueFileName = upath.basename(uriToFsPath(vueDoc.uri));
		let content = '';
		content += `import { GlobalComponents as __VLS_CoreGlobalComponents } from '@vue/runtime-core';\n`;
		if (scriptSetup.value || script.value) {
			content += `import { __VLS_options } from './${vueFileName}.__VLS_script';\n`;
			content += `export { __VLS_options } from './${vueFileName}.__VLS_script';\n`;
			content += `export * from './${vueFileName}.__VLS_script';\n`;
		}
		if (scriptSetup.value) {
			content += `import { __VLS_component } from './${vueFileName}.__VLS_script';\n`;
		}
		else if (script.value) {
			content += `import __VLS_componentRaw from './${vueFileName}.__VLS_script';\n`;
			content += `var __VLS_componentReserve = __VLS_defineComponent(__VLS_componentRaw);\n`;
			content += `type __VLS_ComponentType<T> = T extends new (...args: any) => any ? T : typeof __VLS_componentReserve;\n`;
			content += `export declare var __VLS_component: __VLS_ComponentType<typeof __VLS_componentRaw>;\n`;
		}
		else {
			content += `export var __VLS_options = {};\n`;
			content += `export var __VLS_component = __VLS_defineComponent({});\n`;
		}
		content += `declare var __VLS_ctx: InstanceType<typeof __VLS_component>;\n`;
		content += `declare var __VLS_ComponentsWrap: typeof __VLS_options & { components: { } };\n`;
		content += `declare var __VLS_Components: typeof __VLS_ComponentsWrap.components & __VLS_GlobalComponents & __VLS_CoreGlobalComponents & __VLS_PickComponents<typeof __VLS_ctx>;\n`;
		content += `__VLS_ctx.${SearchTexts.Context};\n`;
		content += `__VLS_Components.${SearchTexts.Components};\n`;
		content += `__VLS_options.setup().${SearchTexts.SetupReturns};\n`;
		content += `__VLS_options.props.${SearchTexts.Props};\n`;
		content += `({} as JSX.IntrinsicElements).${SearchTexts.HtmlElements};\n`;
		content += `\n`;
		content += `export default {} as typeof __VLS_component & {\n`;
		content += `__VLS_raw: typeof __VLS_component\n`;
		content += `__VLS_options: typeof __VLS_options,\n`;
		content += template.value ? `__VLS_slots: typeof import ('./${vueFileName}.__VLS_template').default,` : `// no template\n`;
		content += `};\n`;
		return TextDocument.create(uri, 'typescript', version++, content);
	});
	const sourceMap = computed(() => {
		if (textDocument.value) {
			const vueDoc = getUnreactiveDoc();
			const docText = textDocument.value.getText();
			const sourceMap = new SourceMaps.TsSourceMap(vueDoc, textDocument.value, false, {
				foldingRanges: false,
				formatting: false,
				documentSymbol: false,
				codeActions: false,
				organizeImports: false,
			});
			sourceMap.add({
				data: {
					vueTag: 'script',
					capabilities: {},
				},
				mode: SourceMaps.Mode.Expand,
				sourceRange: {
					start: (scriptSetup.value ?? script.value)?.loc.start ?? 0,
					end: (scriptSetup.value ?? script.value)?.loc.end ?? 0,
				},
				mappedRange: {
					start: 0,
					end: docText.length,
				},
			});
			return sourceMap;
		}
	});
	return {
		textDocument,
		sourceMap,
	};
}

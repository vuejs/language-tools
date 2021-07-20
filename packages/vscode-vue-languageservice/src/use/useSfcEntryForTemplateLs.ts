import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import { IDescriptor } from '../types';
import * as SourceMaps from '../utils/sourceMaps';
import * as upath from 'upath';
import { SearchTexts } from '../utils/string';
import * as shared from '@volar/shared';

export function useSfcEntryForTemplateLs(
	getUnreactiveDoc: () => TextDocument,
	script: Ref<IDescriptor['script']>,
	scriptSetup: Ref<IDescriptor['scriptSetup']>,
	template: Ref<IDescriptor['template']>,
) {
	let version = 0;
	const textDocument = computed(() => {
		const vueDoc = getUnreactiveDoc();
		const uri = `${vueDoc.uri}.ts`;
		const vueFileName = upath.basename(shared.uriToFsPath(vueDoc.uri));
		let content = '';
		if (scriptSetup.value || script.value) {
			content += `import { __VLS_options, __VLS_name } from './${vueFileName}.__VLS_script';\n`;
			content += `export { __VLS_options, __VLS_name } from './${vueFileName}.__VLS_script';\n`;
			content += `export * from './${vueFileName}.__VLS_script';\n`;

			if (scriptSetup.value) {
				content += `import { __VLS_component } from './${vueFileName}.__VLS_script';\n`;
				content += `export { __VLS_component } from './${vueFileName}.__VLS_script';\n`;
			}
			else if (script.value) {
				content += `import __VLS_component_1 from './${vueFileName}.__VLS_script';\n`;
				content += `import { __VLS_component as __VLS_component_2 } from './${vueFileName}.__VLS_script';\n`;
				content += `export declare var __VLS_component: typeof __VLS_component_1 extends (new (...args: infer _1) => infer _2)\n`;
				content += `    ? typeof __VLS_component_1 : typeof __VLS_component_1 extends ((...args: infer _3) => infer _4)\n`;
				content += `    ? typeof __VLS_component_1 : typeof __VLS_component_2;\n`;
			}
		}
		else {
			content += `export var __VLS_options = {};\n`;
			content += `export var __VLS_name = undefined;\n`;
			content += `export var __VLS_component = __VLS_defineComponent({});\n`;
		}
		content += `declare var __VLS_ctx: __VLS_PickNotAny<InstanceType<typeof __VLS_component>, ReturnType<typeof __VLS_component>>;\n`;
		content += `declare var __VLS_ComponentsWrap: typeof __VLS_options & { components: { } };\n`;
		content += `declare var __VLS_Components: typeof __VLS_ComponentsWrap.components & __VLS_GlobalComponents & __VLS_PickComponents<typeof __VLS_ctx> & __VLS_SelfComponent<typeof __VLS_name, typeof __VLS_component>;\n`;
		content += `__VLS_ctx.${SearchTexts.Context};\n`;
		content += `__VLS_Components.${SearchTexts.Components};\n`;
		content += `__VLS_options.setup().${SearchTexts.SetupReturns};\n`;
		content += `__VLS_options.props.${SearchTexts.Props};\n`;
		content += `({} as JSX.IntrinsicElements).${SearchTexts.HtmlElements};\n`;
		content += `\n`;
		content += `export default {} as typeof __VLS_component & {\n`;
		content += `__VLS_raw: typeof __VLS_component\n`;
		content += `__VLS_options: typeof __VLS_options,\n`;
		content += template.value ? `__VLS_slots: typeof import ('./${vueFileName}.__VLS_template').default,\n` : `// no template\n`;
		content += `};\n`;
		return TextDocument.create(uri, 'typescript', version++, content);
	});
	const sourceMap = computed(() => {
		if (textDocument.value) {
			const vueDoc = getUnreactiveDoc();
			const docText = textDocument.value.getText();
			const sourceMap = new SourceMaps.TsSourceMap(vueDoc, textDocument.value, 'template', false, {
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
					start: (script.value ?? scriptSetup.value)?.loc.start ?? 0,
					end: (script.value ?? scriptSetup.value)?.loc.start ?? 0,
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

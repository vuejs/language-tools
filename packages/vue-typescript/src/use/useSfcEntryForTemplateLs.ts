import { computed, Ref } from '@vue/reactivity';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';
import * as SourceMaps from '@volar/source-map';
import * as path from 'path';
import { SearchTexts } from '../utils/string';
import { getVueLibraryName } from '../utils/localTypes';
import { Embedded, EmbeddedFile, Sfc } from '../vueFile';

export function useSfcEntryForTemplateLs(
	fileName: string,
	script: Ref<Sfc['script']>,
	scriptSetup: Ref<Sfc['scriptSetup']>,
	template: Ref<Sfc['template']>,
	hasTsDoc: Ref<boolean>,
	isVue2: boolean,
) {

	const file = computed(() => {

		const baseFileName = path.basename(fileName);
		const tsScriptFileName = hasTsDoc.value ? '__VLS_script_ts' : '__VLS_script';

		let content = '';
		content += '// @ts-nocheck\n';
		content += `import * as __VLS_types from './__VLS_types';\n`;
		if (script.value || scriptSetup.value) {
			content += `import { __VLS_options as __VLS_options_ts } from './${baseFileName}.${tsScriptFileName}';\n`;
			content += `import { __VLS_options, __VLS_name } from './${baseFileName}.__VLS_script';\n`;
			content += `export { __VLS_options, __VLS_name } from './${baseFileName}.__VLS_script';\n`;
			content += `export * from './${baseFileName}.__VLS_script';\n`;
			content += `import __VLS_component_ts from './${baseFileName}.${tsScriptFileName}';\n`;
			content += `import __VLS_component from './${baseFileName}.__VLS_script';\n`;
			content += `export { default as __VLS_component } from './${baseFileName}.__VLS_script';\n`;
		}
		else {
			content += `export var __VLS_name = undefined;\n`;
			content += `export var __VLS_options = {};\n`;
			content += `export var __VLS_component = (await import('${getVueLibraryName(isVue2)}')).defineComponent({});\n`;
			content += `var __VLS_options_ts = {};\n`;
			content += `var __VLS_component_ts = (await import('${getVueLibraryName(isVue2)}')).defineComponent({});\n`;
		}
		content += `declare var __VLS_ctx: __VLS_types.ComponentContext<typeof __VLS_component_ts>;\n`;
		content += `declare var __VLS_ComponentsWrap: typeof __VLS_options & { components: { } };\n`;
		content += `declare var __VLS_Components: NonNullable<typeof __VLS_component extends { components: infer C } ? C : {}> & typeof __VLS_ComponentsWrap.components & __VLS_types.GlobalComponents & __VLS_types.PickComponents<typeof __VLS_ctx> & __VLS_types.SelfComponent<typeof __VLS_name, typeof __VLS_component>;\n`;
		content += `__VLS_ctx.${SearchTexts.Context};\n`;
		content += `__VLS_Components.${SearchTexts.Components};\n`;
		content += `({} as __VLS_types.OptionsSetupReturns<typeof __VLS_options_ts>).${SearchTexts.SetupReturns};\n`;
		content += `({} as __VLS_types.OptionsProps<typeof __VLS_options_ts>).${SearchTexts.Props};\n`;
		content += `({} as __VLS_types.GlobalAttrs).${SearchTexts.GlobalAttrs};`;
		content += `\n`;
		content += `export default {} as typeof __VLS_component & {\n`;
		content += `__VLS_raw: typeof __VLS_component\n`;
		content += `__VLS_options: typeof __VLS_options,\n`;
		content += template.value ? `__VLS_slots: typeof import ('./${baseFileName}.__VLS_template').default,\n` : `// no template\n`;
		content += `};\n`;

		const file: EmbeddedFile = {
			fileName: fileName + '.ts',
			lang: 'ts',
			content,
			lsType: 'template',
			capabilities: {
				diagnostics: false,
				foldingRanges: false,
				formatting: false,
				documentSymbol: false,
				codeActions: false,
			},
			data: undefined,
		};

		return file;
	});
	const embedded = computed<Embedded | undefined>(() => {

		const sourceMap = new EmbeddedFileSourceMap();

		sourceMap.mappings.push({
			data: {
				vueTag: 'sfc',
				capabilities: {},
			},
			mode: SourceMaps.Mode.Expand,
			sourceRange: {
				start: 0,
				end: 0,
			},
			mappedRange: {
				start: 0,
				end: file.value.content.length,
			},
		});

		return {
			file: file.value,
			sourceMap,
		};
	});

	return {
		file,
		embedded,
	};
}

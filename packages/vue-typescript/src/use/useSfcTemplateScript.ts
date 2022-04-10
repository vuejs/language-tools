import { CodeGen, mergeCodeGen } from '@volar/code-gen';
import * as templateGen from '@volar/vue-code-gen/out/generators/template';
import type { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { computed, Ref } from '@vue/reactivity';
import { VueCompilerOptions } from '../types';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';
import { SearchTexts } from '../utils/string';
import type { TextRange } from '@volar/vue-code-gen';
import { Embedded, EmbeddedFile, Sfc } from '../vueFile';
import { useSfcStyles } from './useSfcStyles';
import { EmbeddedFileMappingData } from '@volar/vue-code-gen';
import * as SourceMaps from '@volar/source-map';
import * as path from 'path';
import { walkInterpolationFragment } from '@volar/vue-code-gen/out/transform';
import { getVueLibraryName } from '../utils/localTypes';

export function useSfcTemplateScript(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	fileName: string,
	template: Ref<Sfc['template']>,
	script: Ref<Sfc['script']>,
	scriptSetup: Ref<Sfc['scriptSetup']>,
	scriptSetupRanges: Ref<ReturnType<typeof parseScriptSetupRanges> | undefined>,
	styles: Ref<Sfc['styles']>,
	styleFiles: ReturnType<typeof useSfcStyles>['files'],
	styleEmbeddeds: ReturnType<typeof useSfcStyles>['embeddeds'],
	templateData: Ref<{
		lang: string,
		htmlToTemplate: (start: number, end: number) => { start: number, end: number } | undefined,
	} | undefined>,
	sfcTemplateCompileResult: Ref<ReturnType<(typeof import('@volar/vue-code-gen'))['compileSFCTemplate']> | undefined>,
	sfcStyles: ReturnType<(typeof import('./useSfcStyles'))['useSfcStyles']>['files'],
	scriptLang: Ref<string>,
	compilerOptions: VueCompilerOptions,
	baseCssModuleType: string,
	getCssVBindRanges: (cssEmbeddeFile: EmbeddedFile) => TextRange[],
	getCssClasses: (cssEmbeddeFile: EmbeddedFile) => Record<string, TextRange[]>,
	isVue2: boolean,
	disableTemplateScript: boolean,
) {
	const baseFileName = path.basename(fileName);
	const cssModuleClasses = computed(() =>
		styleFiles.value.reduce((obj, style) => {
			if (style.data.module) {
				const classes = getCssClasses(style);
				obj[style.data.module] = { [style.fileName]: classes };
			}
			return obj;
		}, {} as Record<string, Record<string, Record<string, TextRange[]>>>)
	);
	const cssScopedClasses = computed(() => {
		const obj: Record<string, Record<string, TextRange[]>> = {};
		const setting = compilerOptions.experimentalResolveStyleCssClasses ?? 'scoped';
		for (const style of styleFiles.value) {
			if ((setting === 'scoped' && style.data.scoped) || setting === 'always') {
				const classes = getCssClasses(style);
				obj[style.fileName] = classes;
			}
		}
		return obj;
	});
	const templateCodeGens = computed(() => {

		if (!templateData.value)
			return;
		if (!sfcTemplateCompileResult.value?.ast)
			return;

		return templateGen.generate(
			ts,
			templateData.value.lang,
			sfcTemplateCompileResult.value.ast,
			compilerOptions.experimentalCompatMode === 2,
			Object.values(cssScopedClasses.value).map(map => Object.keys(map)).flat(),
			templateData.value.htmlToTemplate,
			!!scriptSetup.value,
			{
				getEmitCompletion: SearchTexts.EmitCompletion,
				getPropsCompletion: SearchTexts.PropsCompletion,
			}
		);
	});
	const data = computed(() => {

		const codeGen = new CodeGen<EmbeddedFileMappingData>();

		codeGen.addText(`import * as __VLS_types from './__VLS_types';\n`);

		if (script.value || scriptSetup.value) {
			codeGen.addText(`import { __VLS_options, __VLS_name } from './${baseFileName}.__VLS_script';\n`);
			codeGen.addText(`import __VLS_component from './${baseFileName}.__VLS_script';\n`);
		}
		else {
			codeGen.addText(`var __VLS_name = undefined;\n`);
			codeGen.addText(`var __VLS_options = {};\n`);
			codeGen.addText(`var __VLS_component = (await import('${getVueLibraryName(isVue2)}')).defineComponent({});\n`);
		}

		writeImportTypes();

		codeGen.addText(`declare var __VLS_ctx: InstanceType<typeof __VLS_component>;\n`);
		codeGen.addText(`declare var __VLS_vmUnwrap: typeof __VLS_options & { components: { } };\n`);

		/* Components */
		codeGen.addText('/* Components */\n');
		codeGen.addText('declare var __VLS_otherComponents: NonNullable<typeof __VLS_component extends { components: infer C } ? C : {}> & __VLS_types.GlobalComponents & typeof __VLS_vmUnwrap.components & __VLS_types.PickComponents<typeof __VLS_ctx>;\n');
		codeGen.addText('declare var __VLS_ownComponent: __VLS_types.SelfComponent<typeof __VLS_name, typeof __VLS_component>;\n');
		codeGen.addText('declare var __VLS_allComponents: typeof __VLS_otherComponents & Omit<typeof __VLS_ownComponent, keyof typeof __VLS_otherComponents>;\n');
		codeGen.addText('declare var __VLS_rawComponents: __VLS_types.ConvertInvalidComponents<typeof __VLS_allComponents> & JSX.IntrinsicElements;\n'); // sort by priority

		codeGen.addText(`__VLS_allComponents.${SearchTexts.Components};\n`);
		codeGen.addText(`({} as __VLS_types.GlobalAttrs).${SearchTexts.GlobalAttrs};\n`);

		/* CSS Module */
		codeGen.addText('/* CSS Module */\n');
		const cssModuleMappingsArr: ReturnType<typeof writeCssClassProperties>[] = [];
		for (const moduleName in cssModuleClasses.value) {
			const moduleClasses = cssModuleClasses.value[moduleName];
			codeGen.addText(`declare var ${moduleName}: ${baseCssModuleType} & {\n`);
			cssModuleMappingsArr.push(writeCssClassProperties(moduleClasses, true, 'string', false));
			codeGen.addText('};\n');
		}

		/* Style Scoped */
		codeGen.addText('/* Style Scoped */\n');
		codeGen.addText('type __VLS_StyleScopedClasses = {\n');
		const cssScopedMappings = writeCssClassProperties(cssScopedClasses.value, true, 'boolean', true);
		codeGen.addText('};\n');
		codeGen.addText('declare var __VLS_styleScopedClasses: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];\n');

		codeGen.addText(`/* CSS variable injection */\n`);
		writeCssVars();

		if (templateCodeGens.value) {
			mergeCodeGen(codeGen, templateCodeGens.value.codeGen);
		}

		codeGen.addText(`export default __VLS_slots;\n`);

		return {
			codeGen,
			cssModuleMappingsArr,
			cssScopedMappings,
		};

		function writeImportTypes() {

			const bindingsArr: {
				typeBindings: { start: number, end: number }[],
				content: string,
			}[] = [];

			if (scriptSetupRanges.value && scriptSetup.value) {
				bindingsArr.push({
					typeBindings: scriptSetupRanges.value.typeBindings,
					content: scriptSetup.value.content,
				});
			}
			// if (scriptRanges.value && script.value) {
			// 	bindingsArr.push({
			// 		typeBindings: scriptRanges.value.typeBindings,
			// 		content: script.value.content,
			// 	});
			// }

			codeGen.addText('import {\n');
			for (const bindings of bindingsArr) {
				for (const typeBinding of bindings.typeBindings) {
					const text = bindings.content.substring(typeBinding.start, typeBinding.end);
					codeGen.addText(`__VLS_types_${text} as ${text},\n`);
				}
			}
			codeGen.addText(`} from './${baseFileName}.__VLS_script';\n`);
		}
		function writeCssClassProperties(data: Record<string, Record<string, TextRange[]>>, patchRename: boolean, propertyType: string, optional: boolean) {
			const mappings = new Map<string, {
				tsRange: {
					start: number,
					end: number,
				},
				cssRanges: {
					start: number,
					end: number,
				}[],
				mode: SourceMaps.Mode,
				patchRename: boolean,
			}[]>();
			for (const uri in data) {
				const classes = data[uri];
				if (!mappings.has(uri)) {
					mappings.set(uri, []);
				}
				for (const className in classes) {
					const ranges = classes[className];
					mappings.get(uri)!.push({
						tsRange: {
							start: codeGen.getText().length + 1, // + '
							end: codeGen.getText().length + 1 + className.length,
						},
						cssRanges: ranges,
						mode: SourceMaps.Mode.Offset,
						patchRename,
					});
					mappings.get(uri)!.push({
						tsRange: {
							start: codeGen.getText().length,
							end: codeGen.getText().length + className.length + 2,
						},
						cssRanges: ranges,
						mode: SourceMaps.Mode.Totally,
						patchRename,
					});
					codeGen.addText(`'${className}'${optional ? '?' : ''}: ${propertyType},\n`);
				}
			}
			return mappings;
		}
		function writeCssVars() {

			const emptyLocalVars: Record<string, number> = {};

			for (let i = 0; i < sfcStyles.value.length; i++) {

				const style = sfcStyles.value[i];
				const binds = getCssVBindRanges(style);

				for (const cssBind of binds) {
					const bindText = style.content.substring(cssBind.start, cssBind.end);
					walkInterpolationFragment(
						ts,
						bindText,
						(frag, fragOffset) => {
							if (fragOffset === undefined) {
								codeGen.addText(frag);
							}
							else {
								codeGen.addCode(
									frag,
									{
										start: cssBind.start + fragOffset,
										end: cssBind.start + fragOffset + frag.length,
									},
									SourceMaps.Mode.Offset,
									{
										vueTag: 'style',
										vueTagIndex: i,
										capabilities: {
											basic: true,
											references: true,
											definitions: true,
											diagnostic: true,
											rename: true,
											completion: true,
											semanticTokens: true,
										},
									},
								);
							}
						},
						emptyLocalVars,
					)
					codeGen.addText(';\n');
				}
			}
		}
	});
	const embedded = computed<Embedded | undefined>(() => {

		if (!disableTemplateScript && file.value) {
			const sourceMap = new SourceMaps.SourceMapBase<EmbeddedFileMappingData>(
				data.value.codeGen.getMappings(parseMappingSourceRange)
			);

			for (const [fileName, mappings] of [
				...data.value.cssModuleMappingsArr.flatMap(m => [...m]),
				...data.value.cssScopedMappings,
			]) {
				const cssSourceMap = styleEmbeddeds.value.find(embedded => embedded.file.fileName === fileName)?.sourceMap;
				if (!cssSourceMap) continue;
				for (const mapped of mappings) {
					const tsRange = mapped.tsRange;
					for (const cssRange of mapped.cssRanges) {
						const vueRange = cssSourceMap.getSourceRange(cssRange.start, cssRange.end)?.[0];
						if (!vueRange) continue;
						sourceMap.mappings.push({
							data: {
								vueTag: 'style',
								capabilities: {
									references: true,
									rename: true,
									referencesCodeLens: mapped.mode === SourceMaps.Mode.Totally, // has 2 modes
								},
								normalizeNewName: mapped.patchRename ? beforeCssRename : undefined,
								applyNewName: mapped.patchRename ? doCssRename : undefined,
							},
							mode: mapped.mode,
							sourceRange: vueRange,
							mappedRange: tsRange,
						});
					}
				}
			}

			return {
				file: file.value,
				sourceMap,
			};
		}
	});
	const formatEmbedded = computed<Embedded | undefined>(() => {

		if (templateCodeGens.value && formatFile.value) {

			const sourceMap = new EmbeddedFileSourceMap(
				templateCodeGens.value.formatCodeGen.getMappings(parseMappingSourceRange)
			);

			return {
				file: formatFile.value,
				sourceMap,
			};
		}
	});
	const inlineCssFile = computed(() => {

		if (templateCodeGens.value) {

			const file: EmbeddedFile = {
				fileName: fileName + '.template.css',
				lang: 'css',
				content: templateCodeGens.value.cssCodeGen.getText(),
				capabilities: {
					diagnostics: false,
					foldingRanges: false,
					formatting: false,
					codeActions: false,
					documentSymbol: false,
				},
				data: undefined,
				// data: {
				// 	module: false,
				// 	scoped: false,
				// },
				isTsHostFile: false,
			};

			return file;
		}
	});
	const inlineCssEmbedded = computed<Embedded | undefined>(() => {

		if (templateCodeGens.value && inlineCssFile.value) {

			const sourceMap = new EmbeddedFileSourceMap(
				templateCodeGens.value.cssCodeGen.getMappings(parseMappingSourceRange)
			);

			return {
				file: inlineCssFile.value,
				sourceMap,
			};
		}
	});
	const file = computed(() => {
		if (data.value) {
			const lang = scriptLang.value === 'js' ? 'jsx' : scriptLang.value === 'ts' ? 'tsx' : scriptLang.value;
			const embeddedFile: EmbeddedFile = {
				fileName: fileName + '.__VLS_template.' + lang,
				lang: lang,
				content: data.value.codeGen.getText(),
				capabilities: {
					diagnostics: true,
					foldingRanges: false,
					formatting: false,
					documentSymbol: false,
					codeActions: false,
				},
				data: undefined,
				isTsHostFile: true,
			};
			return embeddedFile;
		}
	});
	const formatFile = computed(() => {
		if (templateCodeGens.value) {
			const lang = scriptLang.value === 'js' ? 'jsx' : scriptLang.value === 'ts' ? 'tsx' : scriptLang.value;
			const embeddedFile: EmbeddedFile = {
				fileName: fileName + '.__VLS_template.format.' + lang,
				lang: lang,
				content: templateCodeGens.value.formatCodeGen.getText(),
				capabilities: {
					diagnostics: false,
					foldingRanges: false,
					formatting: true,
					documentSymbol: true,
					codeActions: false,
				},
				data: undefined,
				isTsHostFile: false,
			};
			return embeddedFile;
		}
	});

	return {
		templateCodeGens,
		embedded,
		file,
		formatFile,
		formatEmbedded,
		inlineCssFile,
		inlineCssEmbedded,
	};

	function parseMappingSourceRange(data: EmbeddedFileMappingData, range: SourceMaps.Range) {
		if (data?.vueTag === 'style' && data?.vueTagIndex !== undefined) {
			return {
				start: styles.value[data.vueTagIndex].startTagEnd + range.start,
				end: styles.value[data.vueTagIndex].startTagEnd + range.end,
			};
		}
		const templateOffset = template.value?.startTagEnd ?? 0;
		return {
			start: templateOffset + range.start,
			end: templateOffset + range.end,
		};
	}
}

function beforeCssRename(newName: string) {
	return newName.startsWith('.') ? newName.slice(1) : newName;
}
function doCssRename(oldName: string, newName: string) {
	return '.' + newName;
}

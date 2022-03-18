import { CodeGen, margeCodeGen } from '@volar/code-gen';
import * as templateGen from '@volar/vue-code-gen/out/generators/template';
import type { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { computed, ref, Ref } from '@vue/reactivity';
import { ITemplateScriptData, VueCompilerOptions } from '../types';
import { EmbeddedFileSourceMap, Teleport } from '../utils/sourceMaps';
import { SearchTexts } from '../utils/string';
import type { TeleportMappingData, TextRange } from '@volar/vue-code-gen';
import { Embedded, EmbeddedFile, Sfc } from '../vueFile';
import { useSfcStyles } from './useSfcStyles';
import { EmbeddedFileMappingData } from '@volar/vue-code-gen';
import * as SourceMaps from '@volar/source-map';
import * as upath from 'upath';

export function useSfcTemplateScript(
	fileName: string,
	template: Ref<Sfc['template']>,
	scriptSetup: Ref<Sfc['scriptSetup']>,
	scriptSetupRanges: Ref<ReturnType<typeof parseScriptSetupRanges> | undefined>,
	styles: Ref<Sfc['styles']>,
	templateScriptData: ITemplateScriptData,
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
	getCssVBindRanges: (cssEmbeddeFile: EmbeddedFile) => TextRange[],
	getCssClasses: (cssEmbeddeFile: EmbeddedFile) => Record<string, TextRange[]>,
) {
	const baseFileName = upath.basename(fileName);
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
		for (const style of styleFiles.value) {
			if (style.data.scoped) {
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
		codeGen.addText(`import { __VLS_options, __VLS_name, __VLS_component } from './${baseFileName}';\n`);

		writeImportTypes();

		codeGen.addText(`declare var __VLS_ctxRaw: InstanceType<typeof __VLS_component>;\n`);
		codeGen.addText(`declare var __VLS_ctx: __VLS_types.ExtractRawComponents<typeof __VLS_ctxRaw>;\n`);
		codeGen.addText(`declare var __VLS_vmUnwrap: typeof __VLS_options & { components: { } };\n`);

		/* Components */
		codeGen.addText('/* Components */\n');
		codeGen.addText('declare var __VLS_wrapComponentsRaw: NonNullable<typeof __VLS_component.components> & __VLS_types.GlobalComponents & typeof __VLS_vmUnwrap.components & __VLS_types.PickComponents<typeof __VLS_ctxRaw>;\n'); // has __VLS_options
		codeGen.addText('declare var __VLS_ownComponent: __VLS_types.SelfComponent<typeof __VLS_name, typeof __VLS_component & { __VLS_raw: typeof __VLS_component, __VLS_options: typeof __VLS_options, __VLS_slots: typeof __VLS_slots }>;\n');
		codeGen.addText('declare var __VLS_wrapComponents: typeof __VLS_wrapComponentsRaw & Omit<typeof __VLS_ownComponent, keyof typeof __VLS_wrapComponentsRaw>;\n');
		codeGen.addText('declare var __VLS_rawComponents: __VLS_types.ConvertInvalidComponents<__VLS_types.ExtractRawComponents<typeof __VLS_wrapComponents>> & JSX.IntrinsicElements;\n'); // sort by priority

		/* CSS Module */
		codeGen.addText('/* CSS Module */\n');
		const cssModuleMappingsArr: ReturnType<typeof writeCssClassProperties>[] = [];
		for (const moduleName in cssModuleClasses.value) {
			const moduleClasses = cssModuleClasses.value[moduleName];
			codeGen.addText(`declare var ${moduleName}: Record<string, string> & {\n`);
			cssModuleMappingsArr.push(writeCssClassProperties(moduleClasses, true, 'string', false));
			codeGen.addText('};\n');
		}

		/* Style Scoped */
		codeGen.addText('/* Style Scoped */\n');
		codeGen.addText('type __VLS_StyleScopedClasses = {\n');
		const cssScopedMappings = writeCssClassProperties(cssScopedClasses.value, true, 'boolean', true);
		codeGen.addText('};\n');
		codeGen.addText('declare var __VLS_styleScopedClasses: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];\n');

		/* Props */
		codeGen.addText(`/* Props */\n`);
		const ctxMappings = writeProps();

		codeGen.addText(`/* CSS variable injection */\n`);
		writeCssVars();

		if (templateCodeGens.value) {
			margeCodeGen(codeGen, templateCodeGens.value.codeGen);
		}

		codeGen.addText(`export default __VLS_slots;\n`);

		return {
			codeGen,
			cssModuleMappingsArr,
			cssScopedMappings,
			ctxMappings,
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
		function writeProps() {
			const propsSet = new Set(templateScriptData.props);
			const mappings: SourceMaps.Mapping<TeleportMappingData>[] = [];
			for (const propName of templateScriptData.context) {
				codeGen.addText(`declare let `);
				const templateSideRange = codeGen.addText(propName);
				codeGen.addText(`: typeof __VLS_ctx.`);
				const scriptSideRange = codeGen.addText(propName);
				codeGen.addText(`;`);

				mappings.push({
					data: {
						isAdditionalReference: false,
						toSource: {
							capabilities: {
								definitions: true,
								references: true,
								rename: true,
							},
						},
						toTarget: {
							capabilities: {
								definitions: true,
								references: true,
								rename: true,
							},
						},
					},
					mode: SourceMaps.Mode.Offset,
					sourceRange: scriptSideRange,
					mappedRange: templateSideRange,
				});

				if (propsSet.has(propName)) {
					codeGen.addText(` __VLS_options.props.`);
					const scriptSideRange2 = codeGen.addText(propName);
					codeGen.addText(`;`);

					mappings.push({
						data: {
							isAdditionalReference: true,
							toSource: {
								capabilities: {
									definitions: true,
									references: true,
									rename: true,
								},
							},
							toTarget: {
								capabilities: {
									definitions: true,
									references: true,
									rename: true,
								},
							},
						},
						mode: SourceMaps.Mode.Offset,
						sourceRange: scriptSideRange2,
						mappedRange: templateSideRange,
					});
				}
				codeGen.addText(`\n`);
			}
			return mappings;
		}
		function writeCssVars() {
			for (let i = 0; i < sfcStyles.value.length; i++) {

				const style = sfcStyles.value[i];
				const binds = getCssVBindRanges(style);

				for (const cssBind of binds) {
					const bindText = style.content.substring(cssBind.start, cssBind.end);
					codeGen.addCode(
						bindText,
						cssBind,
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
					codeGen.addText(';\n');
				}
			}
		}
	});
	const embedded = computed<Embedded | undefined>(() => {

		if (file.value) {
			const sourceMap = new SourceMaps.SourceMapBase<EmbeddedFileMappingData>(
				data.value.codeGen.getMappings(parseMappingSourceRange)
			);

			for (const [fileName, mappings] of [
				...data.value.cssModuleMappingsArr.flatMap(m => [...m]),
				...data.value.cssScopedMappings,
			]) {
				const cssSourceMap = styleEmbeddeds.value.find(embedded => embedded.file.fileName === fileName)?.sourceMap;
				if (!cssSourceMap) continue;
				for (const maped of mappings) {
					const tsRange = maped.tsRange;
					for (const cssRange of maped.cssRanges) {
						const vueRange = cssSourceMap.getSourceRange(cssRange.start, cssRange.end)?.[0];
						if (!vueRange) continue;
						sourceMap.mappings.push({
							data: {
								vueTag: 'style',
								capabilities: {
									references: true,
									rename: true,
									referencesCodeLens: maped.mode === SourceMaps.Mode.Totally, // has 2 modes
								},
								normalizeNewName: maped.patchRename ? beforeCssRename : undefined,
								applyNewName: maped.patchRename ? doCssRename : undefined,
							},
							mode: maped.mode,
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
				lsType: 'nonTs',
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
	const file = ref<EmbeddedFile>();
	const formatFile = ref<EmbeddedFile>();
	const teleport = ref<Teleport>();

	return {
		templateCodeGens,
		embedded,
		file,
		formatFile,
		formatEmbedded,
		teleport,
		inlineCssFile,
		inlineCssEmbedded,
		update, // TODO: cheapComputed
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
	function update() {

		const newLang = scriptLang.value === 'js' ? 'jsx' : scriptLang.value === 'ts' ? 'tsx' : scriptLang.value;

		if (data.value?.codeGen.getText() !== file.value?.content || (file.value && file.value.lang !== newLang)) {
			if (data.value) {
				file.value = {
					lsType: 'template',
					fileName: fileName + '.__VLS_template.' + newLang,
					lang: newLang,
					content: data.value.codeGen.getText(),
					capabilities: {
						diagnostics: true,
						foldingRanges: false,
						formatting: false,
						documentSymbol: false,
						codeActions: false,
					},
					data: undefined,
				};
				formatFile.value = templateCodeGens.value ? {
					lsType: 'nonTs',
					fileName: fileName + '.__VLS_template.format.' + newLang,
					lang: newLang,
					content: templateCodeGens.value.formatCodeGen.getText(),
					capabilities: {
						diagnostics: false,
						foldingRanges: false,
						formatting: true,
						documentSymbol: true,
						codeActions: false,
					},
					data: undefined,
				} : undefined;

				const sourceMap = new Teleport();
				for (const maped of data.value.ctxMappings) {
					sourceMap.mappings.push(maped);
				}
				teleport.value = sourceMap;
			}
			else {
				file.value = undefined;
				teleport.value = undefined;
				formatFile.value = undefined;
			}
		}
	}
}

function beforeCssRename(newName: string) {
	return newName.startsWith('.') ? newName.slice(1) : newName;
}
function doCssRename(oldName: string, newName: string) {
	return '.' + newName;
}

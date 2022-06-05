import { CodeGen, mergeCodeGen } from '@volar/code-gen';
import * as templateGen from '@volar/vue-code-gen/out/generators/template';
import type { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { computed, Ref } from '@vue/reactivity';
import { VueCompilerOptions } from '../types';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';
import { SearchTexts } from '../utils/string';
import { getSlotsPropertyName, getVueLibraryName, TextRange } from '@volar/vue-code-gen';
import { Embedded, EmbeddedFile, Sfc } from '../vueFile';
import { EmbeddedFileMappingData } from '@volar/vue-code-gen';
import * as SourceMaps from '@volar/source-map';
import * as path from 'path';
import { walkInterpolationFragment } from '@volar/vue-code-gen/out/transform';
import { parseCssVars } from '../utils/parseCssVars';
import { parseCssClassNames } from '../utils/parseCssClassNames';

export function useSfcTemplateScript(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	fileName: string,
	template: Ref<Sfc['template']>,
	script: Ref<Sfc['script']>,
	scriptSetup: Ref<Sfc['scriptSetup']>,
	scriptSetupRanges: Ref<ReturnType<typeof parseScriptSetupRanges> | undefined>,
	styles: Ref<Sfc['styles']>,
	templateData: Ref<{
		lang: string,
		htmlToTemplate: (start: number, end: number) => { start: number, end: number; } | undefined,
	} | undefined>,
	sfcTemplateCompileResult: Ref<ReturnType<(typeof import('@volar/vue-code-gen'))['compileSFCTemplate']> | undefined>,
	scriptLang: Ref<string>,
	compilerOptions: VueCompilerOptions,
	disableTemplateScript: boolean,
) {
	const baseFileName = path.basename(fileName);
	const scriptLeadingComment = computed(() => {
		let comments: string[] = [];
		if (compilerOptions.experimentalUseScriptLeadingCommentInTemplate ?? true) {
			for (const _script of [script, scriptSetup]) {
				if (_script.value) {
					const commentRanges = ts.getLeadingCommentRanges(_script.value.content, 0);
					if (commentRanges) {
						comments = commentRanges.map(range => _script.value!.content.substring(range.pos, range.end));
					}
				}
			}
		}
		return comments.join('\n');
	});
	const cssModuleClasses = computed(() => {
		const result: { style: typeof styles['value'][number], index: number, classNameRanges: TextRange[]; }[] = [];
		for (let i = 0; i < styles.value.length; i++) {
			const style = styles.value[i];
			if (style.module) {
				result.push({
					style: style,
					index: i,
					classNameRanges: [...parseCssClassNames(style.content)],
				});
			}
		}
		return result;
	});
	const cssScopedClasses = computed(() => {
		const result: { style: typeof styles['value'][number], index: number, classNameRanges: TextRange[]; }[] = [];
		const setting = compilerOptions.experimentalResolveStyleCssClasses ?? 'scoped';
		for (let i = 0; i < styles.value.length; i++) {
			const style = styles.value[i];
			if ((setting === 'scoped' && style.scoped) || setting === 'always') {
				result.push({
					style: style,
					index: i,
					classNameRanges: [...parseCssClassNames(style.content)],
				});
			}
		}
		return result;
	});
	const cssVars = computed(() => {
		const result: { style: typeof styles['value'][number], index: number, ranges: TextRange[]; }[] = [];
		for (let i = 0; i < styles.value.length; i++) {
			const style = styles.value[i];
			result.push({
				style: style,
				index: i,
				ranges: [...parseCssVars(style.content)],
			});
		}
		return result;
	});
	const cssVarTexts = computed(() => {
		const result: string[] = [];
		for (const { style, ranges } of cssVars.value) {
			for (const range of ranges) {
				result.push(style.content.substring(range.start, range.end));
			}
		}
		return result;
	})
	const templateCodeGens = computed(() => {

		if (!templateData.value)
			return;
		if (!sfcTemplateCompileResult.value?.ast)
			return;

		return templateGen.generate(
			ts,
			templateData.value.lang,
			sfcTemplateCompileResult.value.ast,
			compilerOptions.experimentalCompatMode ?? 3,
			compilerOptions.experimentalRuntimeMode,
			!!compilerOptions.experimentalAllowTypeNarrowingInInlineHandlers,
			!!scriptSetup.value,
			Object.values(cssScopedClasses.value).map(map => Object.keys(map)).flat(),
			templateData.value.htmlToTemplate,
			{
				getEmitCompletion: SearchTexts.EmitCompletion,
				getPropsCompletion: SearchTexts.PropsCompletion,
			}
		);
	});
	const tsxCodeGen = computed(() => {

		const codeGen = new CodeGen<EmbeddedFileMappingData>();

		codeGen.addText(scriptLeadingComment.value + '\n');
		codeGen.addText(`import * as __VLS_types from './__VLS_types';\n`);

		if (script.value || scriptSetup.value) {
			codeGen.addText(`import { __VLS_options, __VLS_name } from './${baseFileName}.__VLS_script';\n`);
			codeGen.addText(`import __VLS_component from './${baseFileName}.__VLS_script';\n`);
		}
		else {
			codeGen.addText(`var __VLS_name = undefined;\n`);
			codeGen.addText(`var __VLS_options = {};\n`);
			codeGen.addText(`var __VLS_component = (await import('${getVueLibraryName(compilerOptions.experimentalCompatMode ?? 3)}')).defineComponent({});\n`);
		}

		writeImportTypes();

		codeGen.addText(`declare var __VLS_ctx: InstanceType<typeof __VLS_component> & {\n`);
		/* CSS Module */
		for (const cssModule of cssModuleClasses.value) {
			codeGen.addText(`${cssModule.style.module}: Record<string, string>`);
			for (const classNameRange of cssModule.classNameRanges) {
				writeCssClassProperty(
					cssModule.index,
					cssModule.style.content.substring(classNameRange.start + 1, classNameRange.end),
					classNameRange,
					'string',
					false,
				);
			}
			codeGen.addText(';\n');
		}
		codeGen.addText(`};\n`);

		codeGen.addText(`declare var __VLS_vmUnwrap: typeof __VLS_options & { components: { } };\n`);

		/* Components */
		codeGen.addText('/* Components */\n');
		codeGen.addText('declare var __VLS_otherComponents: NonNullable<typeof __VLS_component extends { components: infer C } ? C : {}> & __VLS_types.GlobalComponents & typeof __VLS_vmUnwrap.components & typeof __VLS_ctx;\n');
		codeGen.addText(`declare var __VLS_selfComponent: __VLS_types.SelfComponent<typeof __VLS_name, typeof __VLS_component & (new () => { ${getSlotsPropertyName(compilerOptions.experimentalCompatMode ?? 3)}: typeof __VLS_slots })>;\n`);
		codeGen.addText('declare var __VLS_components: typeof __VLS_otherComponents & Omit<typeof __VLS_selfComponent, keyof typeof __VLS_otherComponents>;\n');

		codeGen.addText(`__VLS_components.${SearchTexts.Components};\n`);
		codeGen.addText(`({} as __VLS_types.GlobalAttrs).${SearchTexts.GlobalAttrs};\n`);

		/* Style Scoped */
		codeGen.addText('/* Style Scoped */\n');
		codeGen.addText('type __VLS_StyleScopedClasses = {}');
		for (const scopedCss of cssScopedClasses.value) {
			for (const classNameRange of scopedCss.classNameRanges) {
				writeCssClassProperty(
					scopedCss.index,
					scopedCss.style.content.substring(classNameRange.start + 1, classNameRange.end),
					classNameRange,
					'boolean',
					true,
				);
			}
		}
		codeGen.addText(';\n');
		codeGen.addText('declare var __VLS_styleScopedClasses: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];\n');

		codeGen.addText(`/* CSS variable injection */\n`);
		writeCssVars();

		if (templateCodeGens.value) {
			mergeCodeGen(codeGen, templateCodeGens.value.codeGen);
		}

		codeGen.addText(`export default __VLS_slots;\n`);

		return codeGen;

		function writeImportTypes() {

			const bindingsArr: {
				typeBindings: { start: number, end: number; }[],
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
		function writeCssClassProperty(styleIndex: number, className: string, classRange: TextRange, propertyType: string, optional: boolean) {
			codeGen.addText(`\n & { `);
			codeGen.addMapping2({
				mappedRange: {
					start: codeGen.getText().length,
					end: codeGen.getText().length + className.length + 2,
				},
				sourceRange: classRange,
				mode: SourceMaps.Mode.Totally,
				additional: [{
					mappedRange: {
						start: codeGen.getText().length + 1, // + '
						end: codeGen.getText().length + 1 + className.length,
					},
					sourceRange: classRange,
					mode: SourceMaps.Mode.Offset,
				}],
				data: {
					vueTag: 'style',
					vueTagIndex: styleIndex,
					capabilities: {
						references: true,
						rename: true,
						referencesCodeLens: true,
					},
					normalizeNewName: beforeCssRename,
					applyNewName: doCssRename,
				},
			});
			codeGen.addText(`'${className}'${optional ? '?' : ''}: ${propertyType}`);
			codeGen.addText(` }`);
		}
		function writeCssVars() {

			const emptyLocalVars: Record<string, number> = {};
			const identifiers = new Set<string>();

			for (const cssVar of cssVars.value) {
				for (const cssBind of cssVar.ranges) {
					walkInterpolationFragment(
						ts,
						cssVar.style.content.substring(cssBind.start, cssBind.end),
						(frag, fragOffset, isJustForErrorMapping) => {
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
										vueTagIndex: cssVar.index,
										capabilities: isJustForErrorMapping ? {
											diagnostic: true,
										} : {
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
						identifiers,
					);
					codeGen.addText(';\n');
				}
			}
		}
	});
	const embedded = computed<Embedded | undefined>(() => {

		if (!disableTemplateScript && file.value) {
			const sourceMap = new SourceMaps.SourceMapBase<EmbeddedFileMappingData>(
				tsxCodeGen.value.getMappings(parseMappingSourceRange)
			);

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
					inlayHints: false,
				},
				data: undefined,
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
		if (tsxCodeGen.value) {
			const lang = scriptLang.value === 'js' ? 'jsx' : scriptLang.value === 'ts' ? 'tsx' : scriptLang.value;
			const embeddedFile: EmbeddedFile = {
				fileName: fileName + '.__VLS_template.' + lang,
				lang: lang,
				content: tsxCodeGen.value.getText(),
				capabilities: {
					diagnostics: true,
					foldingRanges: false,
					formatting: false,
					documentSymbol: false,
					codeActions: false,
					inlayHints: true,
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
					inlayHints: false,
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
		formatEmbedded,
		inlineCssEmbedded,
		cssVarTexts,
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

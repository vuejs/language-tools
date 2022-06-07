import { CodeGen, mergeCodeGen } from '@volar/code-gen';
import * as SourceMaps from '@volar/source-map';
import { EmbeddedFileMappingData, getSlotsPropertyName, getVueLibraryName, TextRange } from '@volar/vue-code-gen';
import type { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { walkInterpolationFragment } from '@volar/vue-code-gen/out/transform';
import { useCssModuleClasses, useCssScopedClasses, useCssVars } from '../vueFile';
import { ComputedRef } from '@vue/reactivity';
import * as path from 'path';
import { VueCompilerOptions } from '../types';
import { EmbeddedFileSourceMap } from '../utils/sourceMaps';
import { SearchTexts } from '../utils/string';
import { Embedded, EmbeddedFile, VueLanguagePlugin } from '../vueFile';
import * as templateGen from '@volar/vue-code-gen/out/generators/template';

export default function (
	ts: typeof import('typescript/lib/tsserverlibrary'),
	cssModuleClasses: ReturnType<typeof useCssModuleClasses>,
	cssScopedClasses: ReturnType<typeof useCssScopedClasses>,
	templateCodeGens: ComputedRef<ReturnType<typeof templateGen['generate']> | undefined>,
	cssVars: ReturnType<typeof useCssVars>,
	scriptSetupRanges: ComputedRef<ReturnType<typeof parseScriptSetupRanges> | undefined>,
	scriptLang: ComputedRef<string>,
	compilerOptions: VueCompilerOptions,
	disableTemplateScript: boolean,
): VueLanguagePlugin {

	return {

		getEmbeddedFilesCount(sfc) {
			return 3;
		},

		getEmbeddedFile(fileName, sfc, i) {

			const baseFileName = path.basename(fileName);

			if (i === 0 && !disableTemplateScript) {

				let scriptLeadingComments: string[] = [];
				if (compilerOptions.experimentalUseScriptLeadingCommentInTemplate ?? true) {
					for (const _script of [sfc.script, sfc.scriptSetup]) {
						if (_script) {
							const commentRanges = ts.getLeadingCommentRanges(_script.content, 0);
							if (commentRanges) {
								scriptLeadingComments = commentRanges.map(range => _script!.content.substring(range.pos, range.end));
							}
						}
					}
				}
				const scriptLeadingComment = scriptLeadingComments.join('\n');

				const tsxCodeGen = new CodeGen<EmbeddedFileMappingData>();

				tsxCodeGen.addText(scriptLeadingComment + '\n');
				tsxCodeGen.addText(`import * as __VLS_types from './__VLS_types';\n`);

				if (sfc.script || sfc.scriptSetup) {
					tsxCodeGen.addText(`import { __VLS_options, __VLS_name } from './${baseFileName}.__VLS_script';\n`);
					tsxCodeGen.addText(`import __VLS_component from './${baseFileName}.__VLS_script';\n`);
				}
				else {
					tsxCodeGen.addText(`var __VLS_name = undefined;\n`);
					tsxCodeGen.addText(`var __VLS_options = {};\n`);
					tsxCodeGen.addText(`var __VLS_component = (await import('${getVueLibraryName(compilerOptions.target ?? 3)}')).defineComponent({});\n`);
				}

				writeImportTypes();

				tsxCodeGen.addText(`declare var __VLS_ctx: InstanceType<typeof __VLS_component> & {\n`);
				/* CSS Module */
				for (const cssModule of cssModuleClasses.value) {
					tsxCodeGen.addText(`${cssModule.style.module}: Record<string, string>`);
					for (const classNameRange of cssModule.classNameRanges) {
						writeCssClassProperty(
							cssModule.index,
							cssModule.style.content.substring(classNameRange.start + 1, classNameRange.end),
							classNameRange,
							'string',
							false,
						);
					}
					tsxCodeGen.addText(';\n');
				}
				tsxCodeGen.addText(`};\n`);

				tsxCodeGen.addText(`declare var __VLS_vmUnwrap: typeof __VLS_options & { components: { } };\n`);

				/* Components */
				tsxCodeGen.addText('/* Components */\n');
				tsxCodeGen.addText('declare var __VLS_otherComponents: NonNullable<typeof __VLS_component extends { components: infer C } ? C : {}> & __VLS_types.GlobalComponents & typeof __VLS_vmUnwrap.components & __VLS_types.PickComponents<typeof __VLS_ctx>;\n');
				tsxCodeGen.addText(`declare var __VLS_selfComponent: __VLS_types.SelfComponent<typeof __VLS_name, typeof __VLS_component & (new () => { ${getSlotsPropertyName(compilerOptions.target ?? 3)}: typeof __VLS_slots })>;\n`);
				tsxCodeGen.addText('declare var __VLS_components: typeof __VLS_otherComponents & Omit<typeof __VLS_selfComponent, keyof typeof __VLS_otherComponents>;\n');

				tsxCodeGen.addText(`__VLS_components.${SearchTexts.Components};\n`);
				tsxCodeGen.addText(`({} as __VLS_types.GlobalAttrs).${SearchTexts.GlobalAttrs};\n`);

				/* Style Scoped */
				tsxCodeGen.addText('/* Style Scoped */\n');
				tsxCodeGen.addText('type __VLS_StyleScopedClasses = {}');
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
				tsxCodeGen.addText(';\n');
				tsxCodeGen.addText('declare var __VLS_styleScopedClasses: __VLS_StyleScopedClasses | keyof __VLS_StyleScopedClasses | (keyof __VLS_StyleScopedClasses)[];\n');

				tsxCodeGen.addText(`/* CSS variable injection */\n`);
				writeCssVars();

				if (templateCodeGens.value) {
					mergeCodeGen(tsxCodeGen, templateCodeGens.value.codeGen);
				}

				tsxCodeGen.addText(`export default __VLS_slots;\n`);

				const lang = scriptLang.value === 'js' ? 'jsx' : scriptLang.value === 'ts' ? 'tsx' : scriptLang.value;
				const embeddedFile: EmbeddedFile = {
					fileName: fileName + '.__VLS_template.' + lang,
					lang: lang,
					content: tsxCodeGen.getText(),
					capabilities: {
						diagnostics: true,
						foldingRanges: false,
						formatting: false,
						documentSymbol: false,
						codeActions: false,
						inlayHints: true,
					},
					isTsHostFile: true,
				};

				const sourceMap = new SourceMaps.SourceMapBase<EmbeddedFileMappingData>(tsxCodeGen.getMappings());
				const embedded: Embedded = {
					parentFileName: fileName + '.' + sfc.template?.lang,
					file: embeddedFile,
					sourceMap,
				};

				return embedded;

				function writeImportTypes() {

					const bindingsArr: {
						typeBindings: { start: number, end: number; }[],
						content: string,
					}[] = [];

					if (scriptSetupRanges.value && sfc.scriptSetup) {
						bindingsArr.push({
							typeBindings: scriptSetupRanges.value.typeBindings,
							content: sfc.scriptSetup.content,
						});
					}
					// if (scriptRanges.value && script.value) {
					// 	bindingsArr.push({
					// 		typeBindings: scriptRanges.value.typeBindings,
					// 		content: script.value.content,
					// 	});
					// }

					tsxCodeGen.addText('import {\n');
					for (const bindings of bindingsArr) {
						for (const typeBinding of bindings.typeBindings) {
							const text = bindings.content.substring(typeBinding.start, typeBinding.end);
							tsxCodeGen.addText(`__VLS_types_${text} as ${text},\n`);
						}
					}
					tsxCodeGen.addText(`} from './${baseFileName}.__VLS_script';\n`);
				}
				function writeCssClassProperty(styleIndex: number, className: string, classRange: TextRange, propertyType: string, optional: boolean) {
					tsxCodeGen.addText(`\n & { `);
					tsxCodeGen.addMapping2({
						mappedRange: {
							start: tsxCodeGen.getText().length,
							end: tsxCodeGen.getText().length + className.length + 2,
						},
						sourceRange: classRange,
						mode: SourceMaps.Mode.Totally,
						additional: [{
							mappedRange: {
								start: tsxCodeGen.getText().length + 1, // + '
								end: tsxCodeGen.getText().length + 1 + className.length,
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
					tsxCodeGen.addText(`'${className}'${optional ? '?' : ''}: ${propertyType}`);
					tsxCodeGen.addText(` }`);
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
										tsxCodeGen.addText(frag);
									}
									else {
										tsxCodeGen.addCode(
											frag,
											{
												start: cssBind.start + fragOffset,
												end: cssBind.start + fragOffset + frag.length,
											},
											SourceMaps.Mode.Offset,
											{
												vueTag: 'style',
												vueTagIndex: cssVar.styleIndex,
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
							tsxCodeGen.addText(';\n');
						}
					}
				}
			}
			else if (i === 1 && templateCodeGens.value) {

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
					isTsHostFile: false,
				};
				const sourceMap = new EmbeddedFileSourceMap(templateCodeGens.value.formatCodeGen.getMappings());

				return {
					parentFileName: fileName + '.' + sfc.template?.lang,
					file: embeddedFile,
					sourceMap,
				};
			}
			else if (i === 2 && templateCodeGens.value) {

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
					isTsHostFile: false,
				};
				const sourceMap = new EmbeddedFileSourceMap(templateCodeGens.value.cssCodeGen.getMappings());

				return {
					parentFileName: fileName + '.' + sfc.template?.lang,
					file,
					sourceMap,
				};
			}
		},
	};
}

function beforeCssRename(newName: string) {
	return newName.startsWith('.') ? newName.slice(1) : newName;
}

function doCssRename(oldName: string, newName: string) {
	return '.' + newName;
}

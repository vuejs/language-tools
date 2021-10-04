import { CodeGen, createCodeGen, margeCodeGen } from '@volar/code-gen';
import * as shared from '@volar/shared';
import { computed, ref, Ref } from '@vue/reactivity';
import * as upath from 'upath';
import type * as css from 'vscode-css-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as templateGen from '../generators/template';
import * as cssClasses from '../parsers/cssClasses';
import { ITemplateScriptData, LanguageServiceContext } from '../types';
import * as SourceMaps from '../utils/sourceMaps';
import type { parseScriptSetupRanges } from '../parsers/scriptSetupRanges';

export function useSfcTemplateScript(
	vueUri: string,
	vueDoc: Ref<TextDocument>,
	template: Ref<shared.Sfc['template']>,
	scriptSetup: Ref<shared.Sfc['scriptSetup']>,
	scriptSetupRanges: Ref<ReturnType<typeof parseScriptSetupRanges> | undefined>,
	styles: Ref<shared.Sfc['styles']>,
	templateScriptData: ITemplateScriptData,
	styleDocuments: Ref<{
		textDocument: TextDocument;
		stylesheet: css.Stylesheet | undefined;
		links: {
			textDocument: TextDocument;
			stylesheet: css.Stylesheet;
		}[];
		module: string | undefined;
		scoped: boolean;
	}[]>,
	styleSourceMaps: Ref<SourceMaps.CssSourceMap[]>,
	templateData: Ref<{
		sourceLang: 'html' | 'pug',
		html: string,
		htmlToTemplate: (start: number, end: number) => number | undefined,
	} | undefined>,
	sfcTemplateCompileResult: ReturnType<(typeof import('./useSfcTemplateCompileResult'))['useSfcTemplateCompileResult']>,
	sfcStyles: ReturnType<(typeof import('./useSfcStyles'))['useSfcStyles']>['textDocuments'],
	scriptLang: Ref<string>,
	context: LanguageServiceContext,
) {
	let version = 0;
	const vueFileName = upath.basename(shared.uriToFsPath(vueUri));
	const cssModuleClasses = computed(() =>
		styleDocuments.value.reduce((map, style) => {
			if (style.module) {
				map.set(style.module, cssClasses.parse(context.modules.css, [style], context));
			}
			return map;
		}, new Map<string, ReturnType<typeof cssClasses.parse>>())
	);
	const cssScopedClasses = computed(() => cssClasses.parse(context.modules.css, styleDocuments.value.filter(style => style.scoped), context));
	const templateCodeGens = computed(() => {

		if (!templateData.value)
			return;
		if (!sfcTemplateCompileResult.value?.ast)
			return;

		return templateGen.generate(
			templateData.value.sourceLang,
			sfcTemplateCompileResult.value.ast,
			context.isVue2Mode,
			[...cssScopedClasses.value.values()].map(map => [...map.keys()]).flat(),
			templateData.value.htmlToTemplate,
			!!scriptSetup.value,
		);
	});
	const data = computed(() => {

		const codeGen = createCodeGen<SourceMaps.TsMappingData>();

		codeGen.addText(`import * as __VLS_types from './__VLS_types';\n`);
		codeGen.addText(`import { __VLS_options, __VLS_name, __VLS_component } from './${vueFileName}';\n`);

		writeImportTypes();

		codeGen.addText(`declare var __VLS_ctxRaw: InstanceType<typeof __VLS_component>;\n`);
		codeGen.addText(`declare var __VLS_ctx: __VLS_types.ExtractRawComponents<typeof __VLS_ctxRaw>;\n`);
		codeGen.addText(`declare var __VLS_vmUnwrap: typeof __VLS_options & { components: { } };\n`);

		/* Components */
		codeGen.addText('/* Components */\n');
		codeGen.addText('declare var __VLS_ownComponent: __VLS_types.SelfComponent<typeof __VLS_name, typeof __VLS_component & { __VLS_raw: typeof __VLS_component, __VLS_options: typeof __VLS_options, __VLS_slots: typeof __VLS_slots }>;\n');
		codeGen.addText('declare var __VLS_wrapComponents: __VLS_types.GlobalComponents & typeof __VLS_vmUnwrap.components & __VLS_types.PickComponents<typeof __VLS_ctxRaw> & typeof __VLS_ownComponent;\n'); // has __VLS_options
		codeGen.addText('declare var __VLS_rawComponents: __VLS_types.ConvertInvalidComponents<__VLS_types.ExtractRawComponents<typeof __VLS_wrapComponents>> & JSX.IntrinsicElements;\n'); // sort by priority

		/* CSS Module */
		codeGen.addText('/* CSS Module */\n');
		const cssModuleMappingsArr: ReturnType<typeof writeCssClassProperties>[] = [];
		for (const [moduleName, moduleClasses] of cssModuleClasses.value) {
			codeGen.addText(`declare var ${moduleName}: Record<string, string> & {\n`);
			cssModuleMappingsArr.push(writeCssClassProperties(moduleClasses, true));
			codeGen.addText('};\n');
		}

		/* Style Scoped */
		codeGen.addText('/* Style Scoped */\n');
		codeGen.addText('declare var __VLS_styleScopedClasses: {\n');
		const cssScopedMappings = writeCssClassProperties(cssScopedClasses.value, true);
		codeGen.addText('};\n');
		codeGen.addText(`{\n`);

		/* Props */
		codeGen.addText(`/* Props */\n`);
		const ctxMappings = writeProps();

		codeGen.addText(`/* CSS variable injection */\n`);
		writeCssVars();

		if (templateCodeGens.value) {
			margeCodeGen(codeGen as CodeGen, templateCodeGens.value.codeGen as CodeGen);
		}

		codeGen.addText(`}\n`);
		codeGen.addText(`export default __VLS_slots;\n`);

		return {
			...codeGen,
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
			codeGen.addText(`} from './${vueFileName}.__VLS_script';\n`);
		}
		function writeCssClassProperties(data: Map<string, Map<string, Set<[number, number]>>>, patchRename: boolean) {
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
			for (const [uri, classes] of data) {
				if (!mappings.has(uri)) {
					mappings.set(uri, []);
				}
				for (const [className, ranges] of classes) {
					mappings.get(uri)!.push({
						tsRange: {
							start: codeGen.getText().length + 1, // + '
							end: codeGen.getText().length + 1 + className.length,
						},
						cssRanges: [...ranges].map(range => ({
							start: range[0],
							end: range[1],
						})),
						mode: SourceMaps.Mode.Offset,
						patchRename,
					});
					mappings.get(uri)!.push({
						tsRange: {
							start: codeGen.getText().length,
							end: codeGen.getText().length + className.length + 2,
						},
						cssRanges: [...ranges].map(range => ({
							start: range[0],
							end: range[1],
						})),
						mode: SourceMaps.Mode.Totally,
						patchRename,
					});
					codeGen.addText(`'${className}': string,\n`);
				}
			}
			return mappings;
		}
		function writeProps() {
			const propsSet = new Set(templateScriptData.props);
			const mappings: SourceMaps.Mapping<SourceMaps.TeleportMappingData>[] = [];
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
				const docText = style.textDocument.getText();
				for (const cssBind of style.binds) {
					const bindText = docText.substring(cssBind.start, cssBind.end);
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
	const sourceMap = computed(() => {
		if (textDoc.value) {
			const sourceMap = new SourceMaps.TsSourceMap(
				vueDoc.value,
				textDoc.value,
				'template',
				true,
				{
					foldingRanges: false,
					formatting: false,
					documentSymbol: false,
					codeActions: false,
				},
				data.value.getMappings(parseMappingSourceRange),
			);
			for (const [uri, mappings] of [
				...data.value.cssModuleMappingsArr.flatMap(m => [...m]),
				...data.value.cssScopedMappings,
			]) {
				const cssSourceMap = styleSourceMaps.value.find(sourceMap => sourceMap.mappedDocument.uri === uri);
				if (!cssSourceMap) continue;
				for (const maped of mappings) {
					const tsRange = maped.tsRange;
					for (const cssRange of maped.cssRanges) {
						const vueRange = cssSourceMap.getSourceRange2(cssRange.start, cssRange.end);
						if (!vueRange) continue;
						sourceMap.add({
							data: {
								vueTag: 'style',
								capabilities: {
									references: true,
									rename: true,
									referencesCodeLens: maped.mode === SourceMaps.Mode.Totally, // has 2 modes
								},
								beforeRename: maped.patchRename ? beforeCssRename : undefined,
								doRename: maped.patchRename ? doCssRename : undefined,
							},
							mode: maped.mode,
							sourceRange: vueRange,
							mappedRange: tsRange,
						});
					}
				}
			}

			return sourceMap;
		}
	});
	const formatSourceMap = computed(() => {
		if (templateCodeGens.value && formatTextDoc.value && template.value) {
			const sourceMap = new SourceMaps.TsSourceMap(
				vueDoc.value,
				formatTextDoc.value,
				'template',
				true,
				{
					foldingRanges: false,
					formatting: true,
					documentSymbol: false,
					codeActions: false,
				},
				templateCodeGens.value.formatCodeGen.getMappings(parseMappingSourceRange),
			);
			return sourceMap;
		}
	});
	const cssTextDocument = computed(() => {
		if (templateCodeGens.value && template.value) {
			const textDocument = TextDocument.create(vueUri + '.template.css', 'css', 0, templateCodeGens.value.cssCodeGen.getText());
			const stylesheet = context.getCssLs('css')!.parseStylesheet(textDocument);
			return {
				textDocument,
				stylesheet,
				links: [],
				module: false,
				scoped: false,
			};
		}
	});
	const cssSourceMap = computed(() => {
		if (templateCodeGens.value && cssTextDocument.value && template.value) {
			const sourceMap = new SourceMaps.CssSourceMap(
				vueDoc.value,
				cssTextDocument.value.textDocument,
				cssTextDocument.value.stylesheet,
				undefined,
				false,
				[],
				{ foldingRanges: false, formatting: false },
				templateCodeGens.value.cssCodeGen.getMappings(parseMappingSourceRange),
			);
			return sourceMap;
		}
	});
	const textDoc = ref<TextDocument>();
	const formatTextDoc = ref<TextDocument>();
	const teleportSourceMap = ref<SourceMaps.TeleportSourceMap>();

	return {
		templateCodeGens,
		sourceMap,
		textDocument: textDoc,
		textDocumentForFormatting: formatTextDoc,
		sourceMapForFormatting: formatSourceMap,
		teleportSourceMap,
		cssTextDocument,
		cssSourceMap,
		update, // TODO: cheapComputed
	};

	function parseMappingSourceRange(data: any /* TODO */, range: SourceMaps.Range) {
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
		const newLangId = shared.syntaxToLanguageId(newLang);

		if (data.value?.getText() !== textDoc.value?.getText() || (textDoc.value && textDoc.value.languageId !== newLangId)) {
			if (data.value) {
				const _version = version++;
				textDoc.value = TextDocument.create(vueUri + '.__VLS_template.' + newLang, newLangId, _version, data.value.getText());
				formatTextDoc.value = templateCodeGens.value
					? TextDocument.create(vueUri + '.__VLS_template.format.' + newLang, newLangId, _version, templateCodeGens.value.formatCodeGen.getText())
					: undefined;

				const sourceMap = new SourceMaps.TeleportSourceMap(textDoc.value, true);
				for (const maped of data.value.ctxMappings) {
					sourceMap.add(maped);
				}
				teleportSourceMap.value = sourceMap;
			}
			else {
				textDoc.value = undefined;
				teleportSourceMap.value = undefined;
				formatTextDoc.value = undefined;
			}
		}
	}
}

function beforeCssRename(newName: string) {
	return newName.startsWith('.') ? newName.substr(1) : newName;
}
function doCssRename(oldName: string, newName: string) {
	return '.' + newName;
}

import { CodeGen, margeCodeGen } from '@volar/code-gen';
import * as shared from '@volar/shared';
import * as templateGen from '@volar/vue-code-gen/out/generators/template';
import * as cssClasses from '../parsers/cssClasses';
import type { parseScriptSetupRanges } from '@volar/vue-code-gen/out/parsers/scriptSetupRanges';
import { computed, ref, Ref } from '@vue/reactivity';
import * as upath from 'upath';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ITemplateScriptData, BasicRuntimeContext, VueCompilerOptions } from '../types';
import * as SourceMaps from '../utils/sourceMaps';
import { SearchTexts } from '../utils/string';

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
		module: string | undefined;
		scoped: boolean;
	}[]>,
	styleSourceMaps: Ref<SourceMaps.StyleSourceMap[]>,
	templateData: Ref<{
		lang: string,
		htmlToTemplate: (start: number, end: number) => number | undefined,
	} | undefined>,
	sfcTemplateCompileResult: ReturnType<(typeof import('./useSfcTemplateCompileResult'))['useSfcTemplateCompileResult']>,
	sfcStyles: ReturnType<(typeof import('./useSfcStyles'))['useSfcStyles']>['textDocuments'],
	scriptLang: Ref<string>,
	compilerOptions: VueCompilerOptions,
	getCssVBindRanges: BasicRuntimeContext['getCssVBindRanges'],
	getCssClasses: BasicRuntimeContext['getCssClasses'],
) {
	let version = 0;
	const vueFileName = upath.basename(shared.uriToFsPath(vueUri));
	const cssModuleClasses = computed(() =>
		styleDocuments.value.reduce((obj, style) => {
			if (style.module) {
				const classes = getCssClasses(style.textDocument);
				obj[style.module] = { [style.textDocument.uri]: classes };
			}
			return obj;
		}, {} as Record<string, Record<string, ReturnType<typeof cssClasses.findClassNames>>>)
	);
	const cssScopedClasses = computed(() => {
		const obj: Record<string, ReturnType<typeof cssClasses.findClassNames>> = {};
		for (const style of styleDocuments.value) {
			if (style.scoped) {
				const classes = getCssClasses(style.textDocument);
				obj[style.textDocument.uri] = classes;
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

		const codeGen = new CodeGen<SourceMaps.TsMappingData>();

		codeGen.addText(`import * as __VLS_types from './__VLS_types';\n`);
		codeGen.addText(`import { __VLS_options, __VLS_name, __VLS_component } from './${vueFileName}';\n`);

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
			codeGen.addText(`} from './${vueFileName}.__VLS_script';\n`);
		}
		function writeCssClassProperties(data: Record<string, Record<string, [number, number][]>>, patchRename: boolean, propertyType: string, optional: boolean) {
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
					codeGen.addText(`'${className}'${optional ? '?' : ''}: ${propertyType},\n`);
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
				const binds = getCssVBindRanges(style.textDocument);
				const docText = style.textDocument.getText();

				for (const cssBind of binds) {
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
			const sourceMap = new SourceMaps.ScriptSourceMap(
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
				data.value.codeGen.getMappings(parseMappingSourceRange),
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
			const sourceMap = new SourceMaps.ScriptSourceMap(
				vueDoc.value,
				formatTextDoc.value,
				'template',
				true,
				{
					foldingRanges: false,
					formatting: true,
					documentSymbol: true,
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
			return {
				textDocument,
				links: [],
				module: false,
				scoped: false,
			};
		}
	});
	const cssSourceMap = computed(() => {
		if (templateCodeGens.value && cssTextDocument.value && template.value) {
			const sourceMap = new SourceMaps.StyleSourceMap(
				vueDoc.value,
				cssTextDocument.value.textDocument,
				undefined,
				false,
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

		if (data.value?.codeGen.getText() !== textDoc.value?.getText() || (textDoc.value && textDoc.value.languageId !== newLangId)) {
			if (data.value) {
				const _version = version++;
				textDoc.value = TextDocument.create(vueUri + '.__VLS_template.' + newLang, newLangId, _version, data.value.codeGen.getText());
				formatTextDoc.value = templateCodeGens.value
					? TextDocument.create(vueUri + '.__VLS_template.format.' + newLang, newLangId, _version, templateCodeGens.value.formatCodeGen.getText())
					: undefined;

				const sourceMap = new SourceMaps.TeleportSourceMap(textDoc.value);
				for (const maped of data.value.ctxMappings) {
					sourceMap.mappings.push(maped);
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

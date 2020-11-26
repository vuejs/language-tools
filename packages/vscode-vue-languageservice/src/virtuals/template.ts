import { Diagnostic } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath } from '@volar/shared';
import { computed, ref, Ref } from '@vue/reactivity';
import { IDescriptor, ITemplateScriptData } from '../types';
import * as upath from 'upath';
import { SourceMap, MapedMode, TsSourceMap, Mapping, CssSourceMap } from '../utils/sourceMaps';
import { transformVueHtml } from '../utils/vueHtmlConverter';
import { hyphenate } from '@vue/shared';
import * as globalServices from '../globalServices';
import * as css from 'vscode-css-languageservice';
import * as vueDom from '@vue/compiler-dom';

export function useTemplateScript(
	getUnreactiveDoc: () => TextDocument,
	template: Ref<IDescriptor['template']>,
	templateScriptData: ITemplateScriptData,
	styleDocuments: Ref<{
		textDocument: TextDocument;
		stylesheet: css.Stylesheet;
		links: {
			textDocument: TextDocument;
			stylesheet: css.Stylesheet;
		}[];
		module: boolean;
		scoped: boolean;
	}[]>,
	styleSourceMaps: Ref<CssSourceMap[]>,
	pugData: Ref<{
		html: string;
		mapper: (code: string, htmlOffset: number) => number | undefined;
		error?: undefined;
	} | {
		error: Diagnostic;
		html?: undefined;
		mapper?: undefined;
	} | {
		html?: undefined;
		mapper?: undefined;
		error?: undefined;
	}>,
) {
	let version = 0;
	const _vueDoc = getUnreactiveDoc();
	const vueUri = _vueDoc.uri;
	const vueFileName = uriToFsPath(_vueDoc.uri);
	const data = computed(() => {
		const interpolations = getInterpolations();
		if (!interpolations) return;

		let code = [
			`import { FunctionalComponent as __VLS_Vue_FunctionalComponent } from '@vue/runtime-dom'`,
			`import { HTMLAttributes as __VLS_Vue_HTMLAttributes } from '@vue/runtime-dom'`,
			`import { VNodeProps as __VLS_Vue_VNodeProps } from '@vue/runtime-dom'`,
			`import { AllowedComponentProps as __VLS_Vue_AllowedComponentProps } from '@vue/runtime-dom'`,
			`import __VLS_VM from './${upath.basename(vueFileName)}';`,
			(templateScriptData.scriptSetupExports.length
				? `import * as __VLS_setups from './${upath.basename(vueFileName)}.scriptSetup.raw';`
				: `// no setups`),
			`const __VLS_Options = __VLS_VM.__VLS_options`,
			`declare var __VLS_ctx: InstanceType<typeof __VLS_VM>;`,
			`declare var __VLS_vmUnwrap: typeof __VLS_Options & { components: { } };`,
			`declare var __VLS_Components: typeof __VLS_vmUnwrap.components & __VLS_GlobalComponents;`,
		].join('\n') + `\n`;

		/* CSS Module */
		code += '/* CSS Module */\n';
		code += 'declare var $style: {\n';
		const cssModuleClasses = getCssClasses('module');
		const cssModuleMappings = writeCssClassProperties(cssModuleClasses);
		code += '};\n';

		/* Style Scoped */
		code += '/* Style Scoped */\n';
		code += 'declare var __VLS_styleScopedClasses: {\n';
		const cssScopedClasses = getCssClasses('scoped');
		const cssScopedMappings = writeCssClassProperties(cssScopedClasses);
		code += '};\n';

		/* Components */
		code += '/* Components */\n';
		code += 'declare var __VLS_components: __VLS_OmitGlobalAttrs<JSX.IntrinsicElements> & {\n';
		const componentMappings = writeComponents();
		code += '};\n';
		code += 'declare var __VLS_componentPropsBase: __VLS_MapPropsTypeBase<typeof __VLS_components>;\n';
		code += 'declare var __VLS_componentProps: __VLS_MapPropsType<typeof __VLS_components>;\n';
		code += 'declare var __VLS_componentEmits: __VLS_MapEmitType<typeof __VLS_components>;\n'

		/* Completion */
		code += '/* Completion: Emits */\n';
		for (const name of [...templateScriptData.components, ...templateScriptData.htmlElements, ...templateScriptData.context]) {
			if (!hasElement(interpolations.tags, name)) continue;
			code += `__VLS_componentEmits['${name}'][''];\n`; // TODO
		}
		code += '/* Completion: Props */\n';
		for (const name of [...templateScriptData.components, ...templateScriptData.htmlElements, ...templateScriptData.context]) {
			if (!hasElement(interpolations.tags, name)) continue;
			code += `__VLS_componentPropsBase['${name}'][''];\n`; // TODO
		}

		/* Props */
		code += `/* Props */\n`;
		const ctxMappings = writeProps();

		/* Interpolations */
		code += `/* Interpolations */\n`;
		// patch
		for (const maped of interpolations.mappings) {
			maped.targetRange.start += code.length;
			maped.targetRange.end += code.length;
		}
		code += interpolations.text;

		return {
			text: code,
			cssModuleMappings,
			cssScopedMappings,
			componentMappings,
			ctxMappings,
			interpolationsMappings: interpolations.mappings,
		};

		function writeCssClassProperties(data: Map<string, Map<string, Set<[number, number]>>>) {
			const mappings = new Map<string, {
				tsRange: {
					start: number,
					end: number,
				},
				cssRanges: {
					start: number,
					end: number,
				}[],
				mode: MapedMode,
			}[]>();
			for (const [uri, classes] of data) {
				if (!mappings.has(uri)) {
					mappings.set(uri, []);
				}
				for (const [className, ranges] of classes) {
					mappings.get(uri)!.push({
						tsRange: {
							start: code.length + 1, // + '
							end: code.length + 1 + className.length,
						},
						cssRanges: [...ranges].map(range => ({
							start: range[0],
							end: range[1],
						})),
						mode: MapedMode.Offset,
					});
					mappings.get(uri)!.push({
						tsRange: {
							start: code.length,
							end: code.length + className.length + 2,
						},
						cssRanges: [...ranges].map(range => ({
							start: range[0],
							end: range[1],
						})),
						mode: MapedMode.Gate,
					});
					code += `'${className}': string,\n`;
				}
			}
			return mappings;
		}
		function writeComponents() {
			const mappings: Mapping<undefined>[] = [];
			for (const name_1 of templateScriptData.components) {
				const names = new Set([name_1, hyphenate(name_1)]);
				for (const name_2 of names) {
					const start_1 = code.length;
					const end_1 = code.length + `'${name_2}'`.length;
					const start_2 = code.length + `'${name_2}': typeof __VLS_Components[`.length;
					const end_2 = code.length + `'${name_2}': typeof __VLS_Components['${name_1}'`.length;
					mappings.push({
						data: undefined,
						mode: MapedMode.Gate,
						sourceRange: {
							start: start_1,
							end: end_1,
						},
						targetRange: {
							start: start_2,
							end: end_2,
						},
					});
					mappings.push({
						data: undefined,
						mode: MapedMode.Gate,
						sourceRange: {
							start: start_1 + 1,
							end: end_1 - 1,
						},
						targetRange: {
							start: start_2 + 1,
							end: end_2 - 1,
						},
					});
					code += `'${name_2}': typeof __VLS_Components['${name_1}'],\n`;
				}
			}
			for (const name_1 of templateScriptData.context) {
				const names = new Set([name_1, hyphenate(name_1)]);
				for (const name_2 of names) {
					const start_1 = code.length;
					const end_1 = code.length + `'${name_2}'`.length;
					const start_2 = code.length + `'${name_2}': typeof __VLS_ctx[`.length;
					const end_2 = code.length + `'${name_2}': typeof __VLS_ctx['${name_1}'`.length;
					mappings.push({
						data: undefined,
						mode: MapedMode.Gate,
						sourceRange: {
							start: start_1,
							end: end_1,
						},
						targetRange: {
							start: start_2,
							end: end_2,
						},
					});
					mappings.push({
						data: undefined,
						mode: MapedMode.Gate,
						sourceRange: {
							start: start_1 + 1,
							end: end_1 - 1,
						},
						targetRange: {
							start: start_2 + 1,
							end: end_2 - 1,
						},
					});
					code += `'${name_2}': typeof __VLS_ctx['${name_1}'],\n`;
				}
			}
			return mappings;
		}
		function writeProps() {
			const propsSet = new Set(templateScriptData.props);
			const scriptSetupExportsSet = new Set(templateScriptData.scriptSetupExports);
			const mappings: Mapping<{ isAdditionalReference: boolean }>[] = [];
			for (const propName of templateScriptData.context) {
				const vueRange = {
					start: code.length + `var `.length,
					end: code.length + `var ${propName}`.length,
				};
				mappings.push({
					data: { isAdditionalReference: false },
					mode: MapedMode.Offset,
					sourceRange: vueRange,
					targetRange: {
						start: code.length + `var ${propName} = __VLS_ctx.`.length,
						end: code.length + `var ${propName} = __VLS_ctx.${propName}`.length,
					},
				});
				code += `var ${propName} = __VLS_ctx.${propName}; `;
				if (propsSet.has(propName)) {
					mappings.push({
						data: { isAdditionalReference: true },
						mode: MapedMode.Offset,
						sourceRange: vueRange,
						targetRange: {
							start: code.length + `__VLS_Options.props.`.length,
							end: code.length + `__VLS_Options.props.${propName}`.length,
						},
					});
					code += `__VLS_Options.props.${propName}; `;
				}
				if (scriptSetupExportsSet.has(propName)) {
					mappings.push({
						data: { isAdditionalReference: true },
						mode: MapedMode.Offset,
						sourceRange: vueRange,
						targetRange: {
							start: code.length + `__VLS_setups.`.length,
							end: code.length + `__VLS_setups.${propName}`.length,
						},
					});
					code += `__VLS_setups.${propName}; `
				}
				code += `\n`;
			}
			return mappings;
		}
		function hasElement(tags: Set<string>, tagName: string) {
			return tags.has(tagName) || tags.has(hyphenate(tagName));
		}
		function getCssClasses(type: 'module' | 'scoped') {
			const result = new Map<string, Map<string, Set<[number, number]>>>();
			for (const sourceMap of styleDocuments.value) {
				if (type === 'module' && !sourceMap.module)
					continue;
				if (type === 'scoped' && !sourceMap.scoped)
					continue;
				for (const [className, offsets] of findClassNames(sourceMap.textDocument, sourceMap.stylesheet)) {
					for (const offset of offsets) {
						addClassName(sourceMap.textDocument.uri, className, offset);
					}
				}
				for (const link of sourceMap.links) {
					for (const [className, offsets] of findClassNames(link.textDocument, link.stylesheet)) {
						for (const offset of offsets) {
							addClassName(sourceMap.textDocument.uri, className, offset);
						}
					}
				}
			}
			return result;
			function addClassName(uri: string, className: string, range: [number, number]) {
				if (!result.has(uri))
					result.set(uri, new Map());
				if (!result.get(uri)!.has(className))
					result.get(uri)!.set(className, new Set());
				result.get(uri)!.get(className)?.add(range);
			}
		}
		function getInterpolations() {
			const html = pugData.value?.html ?? template.value?.content;
			if (!html) return;
			try {
				const ast = vueDom.compile(html, { onError: () => { } }).ast;
				return transformVueHtml(
					ast,
					pugData.value?.mapper,
				);
			}
			catch (err) {
				return {
					text: '',
					mappings: [],
					tags: new Set<string>(),
				};
			}
		}
	});
	const sourceMap = computed(() => {
		if (data.value && textDocument.value && template.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new TsSourceMap(vueDoc, textDocument.value, true, { foldingRanges: false, formatting: true });
			{ // diagnostic for '@vue/runtime-dom' package not exist
				const text = `'@vue/runtime-dom'`;
				const textIndex = textDocument.value.getText().indexOf(text);
				const virtualRange = {
					start: textIndex,
					end: textIndex + text.length,
				};
				sourceMap.add({
					data: {
						vueTag: 'template',
						capabilities: {
							basic: false,
							references: false,
							rename: false,
							diagnostic: true,
							formatting: false,
							completion: false,
							semanticTokens: false,
						},
					},
					mode: MapedMode.Gate,
					sourceRange: {
						start: template.value.loc.start,
						end: template.value.loc.start,
					},
					targetRange: virtualRange,
				});
			}
			for (const [uri, mappings] of [...data.value.cssModuleMappings, ...data.value.cssScopedMappings]) {
				const cssSourceMap = styleSourceMaps.value.find(sourceMap => sourceMap.targetDocument.uri === uri);
				if (!cssSourceMap) continue;
				for (const maped of mappings) {
					const tsRange = maped.tsRange;
					for (const cssRange of maped.cssRanges) {
						const vueLoc = cssSourceMap.targetToSource2(cssRange);
						if (!vueLoc) continue;
						sourceMap.add({
							data: {
								vueTag: 'style',
								capabilities: {
									basic: true,
									references: true,
									rename: true,
									diagnostic: true,
									formatting: false,
									completion: true,
									semanticTokens: false,
									referencesCodeLens: maped.mode === MapedMode.Gate, // has 2 modes
								},
							},
							mode: maped.mode,
							sourceRange: vueLoc.range,
							targetRange: tsRange,
						});
					}
				}
			}
			for (const maped of data.value.interpolationsMappings) {
				sourceMap.add({
					data: maped.data,
					mode: maped.mode,
					sourceRange: {
						start: maped.sourceRange.start + template.value.loc.start,
						end: maped.sourceRange.end + template.value.loc.start,
					},
					targetRange: maped.targetRange,
				});
			}

			return sourceMap;
		}
	});
	const textDocument = ref<TextDocument>();
	const contextSourceMap = ref<SourceMap<{
		isAdditionalReference: boolean;
	}>>();
	const componentSourceMap = ref<SourceMap<unknown>>();

	return {
		sourceMap,
		textDocument,
		contextSourceMap,
		componentSourceMap,
		update, // TODO: cheapComputed
	};

	function update() {
		if (data.value?.text !== textDocument.value?.getText()) {
			if (data.value) {
				textDocument.value = TextDocument.create(vueUri + '.template.ts', 'typescript', version++, data.value.text);
				{
					const sourceMap = new SourceMap<{ isAdditionalReference: boolean }>(
						textDocument.value,
						textDocument.value,
					);
					for (const maped of data.value.ctxMappings) {
						sourceMap.add(maped);
					}
					contextSourceMap.value = sourceMap;
				}
				{
					const sourceMap = new SourceMap(
						textDocument.value,
						textDocument.value,
					);
					for (const maped of data.value.componentMappings) {
						sourceMap.add(maped);
					}
					componentSourceMap.value = sourceMap;
				}
			}
			else {
				textDocument.value = undefined;
				contextSourceMap.value = undefined;
				componentSourceMap.value = undefined;
			}
		}
	}
}

function findClassNames(doc: TextDocument, ss: css.Stylesheet) {
	const result = new Map<string, Set<[number, number]>>();
	const cssLanguageService = globalServices.getCssService(doc.languageId);
	const symbols = cssLanguageService.findDocumentSymbols(doc, ss);
	for (const s of symbols) {
		if (s.kind === css.SymbolKind.Class) {
			const nodeText = doc.getText(s.location.range);
			// https://stackoverflow.com/questions/448981/which-characters-are-valid-in-css-class-names-selectors
			const classNames_1 = s.name.matchAll(/(?<=\.)-?[_a-zA-Z]+[_a-zA-Z0-9-]*/g);
			const classNames_2 = nodeText.matchAll(/(?<=\.)-?[_a-zA-Z]+[_a-zA-Z0-9-]*/g);

			for (const _className_1 of classNames_1) {
				if (_className_1.index === undefined) continue;
				const className_1 = _className_1.toString();
				for (const _className_2 of classNames_2) {
					if (_className_2.index === undefined) continue;
					const className_2 = _className_2.toString();
					if (className_1 === className_2) {
						if (!result.has(className_1)) {
							result.set(className_1, new Set());
						}
						const startIndex = doc.offsetAt(s.location.range.start) + _className_2.index - 1;
						result.get(className_1)!.add([startIndex, startIndex + className_1.length + 1]);
						break;
					}
				}
			}
		}
	}
	return result;
}

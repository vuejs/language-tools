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
import { SearchTexts } from './common';

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
		mapper: (htmlStart: number, htmlEnd: number) => number | undefined;
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

		let text1 = [
			`import { FunctionalComponent as __VLS_Vue_FunctionalComponent } from '@vue/runtime-dom'`,
			`import { HTMLAttributes as __VLS_Vue_HTMLAttributes } from '@vue/runtime-dom'`,
			`import { VNodeProps as __VLS_Vue_VNodeProps } from '@vue/runtime-dom'`,
			`import { AllowedComponentProps as __VLS_Vue_AllowedComponentProps } from '@vue/runtime-dom'`,
			`import { __VLS_options, __VLS_component } from './${upath.basename(vueFileName)}';`,
			`export declare var __VLS_ctx: InstanceType<typeof __VLS_component>;`,
			`export declare var __VLS_vmUnwrap: typeof __VLS_options & { components: { } };`,
			`export declare var __VLS_Components: typeof __VLS_vmUnwrap.components & __VLS_GlobalComponents & __VLS_PickComponents<typeof __VLS_ctx>;`,
		].join('\n') + `\n`;

		/* Components */
		text1 += '/* Components */\n';
		text1 += 'export declare var __VLS_components: JSX.IntrinsicElements & typeof __VLS_Components;\n';
		text1 += 'export declare var __VLS_componentPropsBase: __VLS_MapPropsTypeBase<typeof __VLS_components>;\n';
		text1 += 'export declare var __VLS_componentProps: __VLS_MapPropsType<typeof __VLS_components>;\n';
		text1 += 'export declare var __VLS_componentEmits: __VLS_MapEmitType<typeof __VLS_components>;\n'

		/* Completion */
		text1 += `({} as __VLS_GlobalAttrs).${SearchTexts.GlobalAttrs};\n`;

		text1 += '/* Completion: Emits */\n';
		for (const name of [...templateScriptData.components, ...templateScriptData.htmlElements]) {
			if (!hasElement(interpolations.tags, name)) continue;
			text1 += `__VLS_componentEmits['${name}'][''];\n`; // TODO
		}
		text1 += '/* Completion: Props */\n';
		for (const name of [...templateScriptData.components, ...templateScriptData.htmlElements]) {
			if (!hasElement(interpolations.tags, name)) continue;
			text1 += `__VLS_componentPropsBase['${name}'][''];\n`; // TODO
		}
		text1 += '/* Completion: Slots */\n';
		for (const name of [...templateScriptData.components, ...templateScriptData.htmlElements]) {
			if (!hasElement(interpolations.tags, name)) continue;
			text1 += `__VLS_components['${name}'].__VLS_slots[''];\n`; // TODO
		}

		let text2 = [
			(templateScriptData.scriptSetupExports.length
				? `import * as __VLS_setups from './${upath.basename(vueFileName)}.scriptSetup.raw';`
				: `// no setups`),
			`import { __VLS_options } from './${upath.basename(vueFileName)}';`,
			`import { __VLS_ctx } from './${upath.basename(vueFileName)}.__VLS_template.context';`,
			`import { __VLS_vmUnwrap } from './${upath.basename(vueFileName)}.__VLS_template.context';`,
			`import { __VLS_components } from './${upath.basename(vueFileName)}.__VLS_template.context';`,
			`import { __VLS_componentPropsBase } from './${upath.basename(vueFileName)}.__VLS_template.context';`,
			`import { __VLS_componentProps } from './${upath.basename(vueFileName)}.__VLS_template.context';`,
			`import { __VLS_componentEmits } from './${upath.basename(vueFileName)}.__VLS_template.context';`,
		].join('\n') + '\n';

		/* CSS Module */
		text2 += '/* CSS Module */\n';
		text2 += 'declare var $style: {\n';
		const cssModuleClasses = getCssClasses('module');
		const cssModuleMappings = writeCssClassProperties(cssModuleClasses);
		text2 += '};\n';

		/* Style Scoped */
		text2 += '/* Style Scoped */\n';
		text2 += 'declare var __VLS_styleScopedClasses: {\n';
		const cssScopedClasses = getCssClasses('scoped');
		const cssScopedMappings = writeCssClassProperties(cssScopedClasses);
		text2 += '};\n';

		/* Props */
		text2 += `/* Props */\n`;
		const ctxMappings = writeProps();

		/* Interpolations */
		text2 += `/* Interpolations */\n`;
		// patch
		for (const maped of interpolations.mappings) {
			maped.targetRange.start += text2.length;
			maped.targetRange.end += text2.length;
		}
		text2 += interpolations.text;

		return {
			text1,
			text2,
			cssModuleMappings,
			cssScopedMappings,
			ctxMappings,
			interpolations,
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
							start: text2.length + 1, // + '
							end: text2.length + 1 + className.length,
						},
						cssRanges: [...ranges].map(range => ({
							start: range[0],
							end: range[1],
						})),
						mode: MapedMode.Offset,
					});
					mappings.get(uri)!.push({
						tsRange: {
							start: text2.length,
							end: text2.length + className.length + 2,
						},
						cssRanges: [...ranges].map(range => ({
							start: range[0],
							end: range[1],
						})),
						mode: MapedMode.Gate,
					});
					text2 += `'${className}': string,\n`;
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
					start: text2.length + `declare let `.length,
					end: text2.length + `declare let ${propName}`.length,
				};
				mappings.push({
					data: { isAdditionalReference: false },
					mode: MapedMode.Offset,
					sourceRange: vueRange,
					targetRange: {
						start: text2.length + `declare let ${propName}: typeof __VLS_ctx.`.length,
						end: text2.length + `declare let ${propName}: typeof __VLS_ctx.${propName}`.length,
					},
				});
				text2 += `declare let ${propName}: typeof __VLS_ctx.${propName}; `;
				if (propsSet.has(propName)) {
					mappings.push({
						data: { isAdditionalReference: true },
						mode: MapedMode.Offset,
						sourceRange: vueRange,
						targetRange: {
							start: text2.length + `__VLS_options.props.`.length,
							end: text2.length + `__VLS_options.props.${propName}`.length,
						},
					});
					text2 += `__VLS_options.props.${propName}; `;
				}
				if (scriptSetupExportsSet.has(propName)) {
					mappings.push({
						data: { isAdditionalReference: true },
						mode: MapedMode.Offset,
						sourceRange: vueRange,
						targetRange: {
							start: text2.length + `__VLS_setups.`.length,
							end: text2.length + `__VLS_setups.${propName}`.length,
						},
					});
					text2 += `__VLS_setups.${propName}; `
				}
				text2 += `\n`;
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
					templateScriptData.components,
					pugData.value?.mapper,
				);
			}
			catch (err) {
				return {
					text: '',
					mappings: [],
					cssCode: '',
					cssMappings: [],
					tags: new Set<string>(),
					formatCode: '',
					formapMappings: [],
				};
			}
		}
	});
	const sourceMap = computed(() => {
		if (data.value && textDocument2.value && template.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new TsSourceMap(vueDoc, textDocument2.value, true, { foldingRanges: false, formatting: false });
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
			for (const maped of data.value.interpolations.mappings) {
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
	const sourceMapForFormatting = computed(() => {
		if (data.value && textDocumentForFormatting.value && template.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new TsSourceMap(vueDoc, textDocumentForFormatting.value, true, { foldingRanges: false, formatting: true });
			for (const maped of data.value.interpolations.formapMappings) {
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
	const cssTextDocument = computed(() => {
		if (data.value) {
			const textDocument = TextDocument.create(vueUri + '.template.css', 'css', 0, data.value.interpolations.cssCode);
			const stylesheet = globalServices.css.parseStylesheet(textDocument);
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
		if (data.value && cssTextDocument.value && template.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new CssSourceMap(
				vueDoc,
				cssTextDocument.value.textDocument,
				cssTextDocument.value.stylesheet,
				false,
				false,
				[],
				{ foldingRanges: false, formatting: false },
			);
			for (const maped of data.value.interpolations.cssMappings) {
				sourceMap.add({
					data: undefined,
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
	const textDocument1 = ref<TextDocument>();
	const textDocument2 = ref<TextDocument>();
	const textDocumentForFormatting = ref<TextDocument>();
	const contextSourceMap = ref<SourceMap<{
		isAdditionalReference: boolean;
	}>>();

	return {
		sourceMap,
		textDocument1,
		textDocument2,
		textDocumentForFormatting,
		sourceMapForFormatting,
		contextSourceMap,
		cssTextDocument,
		cssSourceMap,
		update, // TODO: cheapComputed
	};

	function update() {
		if (data.value?.text1 !== textDocument1.value?.getText() || data.value?.text2 !== textDocument2.value?.getText()) {
			if (data.value) {
				const _version = version++;
				textDocument1.value = TextDocument.create(vueUri + '.__VLS_template.context.ts', 'typescript', _version, data.value.text1);
				textDocument2.value = TextDocument.create(vueUri + '.__VLS_template.ts', 'typescript', _version, data.value.text2);
				textDocumentForFormatting.value = TextDocument.create(vueUri + '.__VLS_template.format.ts', 'typescript', _version, data.value.interpolations.formatCode);
				{
					const sourceMap = new SourceMap<{ isAdditionalReference: boolean }>(
						textDocument2.value,
						textDocument2.value,
					);
					for (const maped of data.value.ctxMappings) {
						sourceMap.add(maped);
					}
					contextSourceMap.value = sourceMap;
				}
			}
			else {
				textDocument1.value = undefined;
				textDocument2.value = undefined;
				contextSourceMap.value = undefined;
				textDocumentForFormatting.value = undefined;
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

import { TextDocument } from 'vscode-languageserver-textdocument';
import { uriToFsPath } from '@volar/shared';
import { computed, ref, Ref } from '@vue/reactivity';
import { IDescriptor, ITemplateScriptData } from '../types';
import * as upath from 'upath';
import * as SourceMaps from '../utils/sourceMaps';
import { createScriptGenerator } from '@volar/source-map';
import * as templateGen from '../generators/template';
import * as cssClasses from '../parsers/cssClasses';
import { hyphenate } from '@vue/shared';
import * as languageServices from '../utils/languageServices';
import * as css from 'vscode-css-languageservice';
import { SearchTexts } from '../utils/string';

export function useTemplateScript(
	getUnreactiveDoc: () => TextDocument,
	template: Ref<IDescriptor['template']>,
	templateScriptData: ITemplateScriptData,
	styleDocuments: Ref<{
		textDocument: TextDocument;
		stylesheet: css.Stylesheet | undefined;
		links: {
			textDocument: TextDocument;
			stylesheet: css.Stylesheet;
		}[];
		module: boolean;
		scoped: boolean;
	}[]>,
	styleSourceMaps: Ref<SourceMaps.CssSourceMap[]>,
	templateData: Ref<{
		html?: string,
		htmlToTemplate?: (start: number, end: number) => number | undefined,
	} | undefined>,
) {
	let version = 0;
	const _vueDoc = getUnreactiveDoc();
	const vueUri = _vueDoc.uri;
	const vueFileName = upath.basename(uriToFsPath(_vueDoc.uri));
	const cssModuleClasses = computed(() => cssClasses.parse(styleDocuments.value.filter(style => style.module)));
	const cssScopedClasses = computed(() => cssClasses.parse(styleDocuments.value.filter(style => style.scoped)));
	const interpolations = computed(() => {
		if (templateData.value?.html === undefined)
			return;

		return templateGen.generate(
			templateData.value.html,
			templateScriptData.components,
			templateScriptData.htmlElements,
			[...cssScopedClasses.value.values()].map(map => [...map.keys()]).flat(),
			templateData.value.htmlToTemplate,
		);
	});
	const data = computed(() => {
		if (!interpolations.value)
			return;

		const gen = createScriptGenerator<SourceMaps.TsMappingData>();

		gen.addText(`import { GlobalComponents as __VLS_CoreGlobalComponents } from '@vue/runtime-core';\n`);
		gen.addText(`import { __VLS_options, __VLS_component } from './${vueFileName}';\n`);
		gen.addText(`declare const __VLS_ctx: InstanceType<typeof __VLS_component>;\n`);
		gen.addText(`declare const __VLS_vmUnwrap: typeof __VLS_options & { components: { } };\n`);

		/* Components */
		gen.addText('/* Components */\n');
		gen.addText('declare const __VLS_components: __VLS_GlobalComponents & __VLS_CoreGlobalComponents & typeof __VLS_vmUnwrap.components & __VLS_PickComponents<typeof __VLS_ctx> & JSX.IntrinsicElements;\n'); // sort by priority
		gen.addText('declare const __VLS_componentPropsBase: __VLS_MapPropsTypeBase<typeof __VLS_components>;\n');
		gen.addText('declare const __VLS_componentProps: __VLS_MapPropsType<typeof __VLS_components>;\n');
		gen.addText('declare const __VLS_componentEmits: __VLS_MapEmitType<typeof __VLS_components>;\n');

		/* Completion */
		gen.addText(`({} as __VLS_GlobalAttrs).${SearchTexts.GlobalAttrs};\n`);

		gen.addText('/* Completion: Emits */\n');
		for (const name of [...templateScriptData.components, ...templateScriptData.htmlElements]) {
			if (!hasElement(interpolations.value.tags, name)) continue;
			gen.addText(`// @ts-ignore\n`);
			gen.addText(`__VLS_componentEmits['${name}']('');\n`); // TODO
		}
		gen.addText('/* Completion: Props */\n');
		for (const name of [...templateScriptData.components, ...templateScriptData.htmlElements]) {
			if (!hasElement(interpolations.value.tags, name)) continue;
			gen.addText(`// @ts-ignore\n`);
			gen.addText(`__VLS_componentPropsBase['${name}'][''];\n`); // TODO
		}
		gen.addText('/* Completion: Slots */\n');
		for (const name of [...templateScriptData.components, ...templateScriptData.htmlElements]) {
			if (!hasElement(interpolations.value.tags, name)) continue;
			gen.addText(`// @ts-ignore\n`);
			gen.addText(`__VLS_components['${name}'].__VLS_slots[''];\n`); // TODO
		}

		/* CSS Module */
		gen.addText('/* CSS Module */\n');
		gen.addText('declare const $style: {\n');
		const cssModuleMappings = writeCssClassProperties(cssModuleClasses.value, false);
		gen.addText('};\n');

		/* Style Scoped */
		gen.addText('/* Style Scoped */\n');
		gen.addText('declare const __VLS_styleScopedClasses: {\n');
		const cssScopedMappings = writeCssClassProperties(cssScopedClasses.value, true);
		gen.addText('};\n');

		/* Props */
		gen.addText(`/* Props */\n`);
		const ctxMappings = writeProps();

		/* Interpolations */
		gen.addText(`/* Interpolations */\n`);
		// patch
		const crtOffset = gen.getText().length;
		for (const maped of interpolations.value.mappings) {
			gen.addMapping2({
				...maped,
				mappedRange: {
					start: maped.mappedRange.start + crtOffset,
					end: maped.mappedRange.end + crtOffset,
				},
				additional: maped.additional ? maped.additional.map(other => ({
					...other,
					mappedRange: {
						start: other.mappedRange.start + crtOffset,
						end: other.mappedRange.end + crtOffset,
					},
				})) : undefined,
			});
		}
		gen.addText(interpolations.value.text);

		return {
			text: gen.getText(),
			mappings: gen.getMappings(),
			cssModuleMappings,
			cssScopedMappings,
			ctxMappings,
		};

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
							start: gen.getText().length + 1, // + '
							end: gen.getText().length + 1 + className.length,
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
							start: gen.getText().length,
							end: gen.getText().length + className.length + 2,
						},
						cssRanges: [...ranges].map(range => ({
							start: range[0],
							end: range[1],
						})),
						mode: SourceMaps.Mode.Totally,
						patchRename,
					});
					gen.addText(`'${className}': string,\n`);
				}
			}
			return mappings;
		}
		function writeProps() {
			const propsSet = new Set(templateScriptData.props);
			const mappings: SourceMaps.Mapping<SourceMaps.TeleportMappingData>[] = [];
			for (const propName of templateScriptData.context) {
				gen.addText(`declare var `);
				const templateSideRange = gen.addText(propName);
				gen.addText(`: typeof __VLS_ctx.`);
				const scriptSideRange = gen.addText(propName);
				gen.addText(`;`);

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
					gen.addText(` __VLS_options.props.`);
					const scriptSideRange2 = gen.addText(propName);
					gen.addText(`;`);

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
				gen.addText(`\n`);
			}
			return mappings;
		}
		function hasElement(tags: Set<string>, tagName: string) {
			return tags.has(tagName) || tags.has(hyphenate(tagName));
		}
	});
	const sourceMap = computed(() => {
		if (data.value && textDocument.value && template.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new SourceMaps.TsSourceMap(vueDoc, textDocument.value, true, {
				foldingRanges: false,
				formatting: false,
				documentSymbol: false,
				codeActions: false,
				organizeImports: false,
			});
			for (const [uri, mappings] of [...data.value.cssModuleMappings, ...data.value.cssScopedMappings]) {
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
								beforeRename: maped.patchRename ? (newName => newName.startsWith('.') ? newName.substr(1) : newName) : undefined,
								doRename: maped.patchRename ? ((oldName, newName) => '.' + newName) : undefined,
							},
							mode: maped.mode,
							sourceRange: vueRange,
							mappedRange: tsRange,
						});
					}
				}
			}
			for (const maped of data.value.mappings) {
				sourceMap.add({
					...maped,
					sourceRange: {
						start: maped.sourceRange.start + template.value.loc.start,
						end: maped.sourceRange.end + template.value.loc.start,
					},
					additional: maped.additional ? maped.additional.map(other => ({
						...other,
						sourceRange: {
							start: other.sourceRange.start + template.value!.loc.start,
							end: other.sourceRange.end + template.value!.loc.start,
						},
					})) : undefined,
				});
			}

			return sourceMap;
		}
	});
	const sourceMapForFormatting = computed(() => {
		if (interpolations.value && textDocumentForFormatting.value && template.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new SourceMaps.TsSourceMap(vueDoc, textDocumentForFormatting.value, true, {
				foldingRanges: false,
				formatting: true,
				documentSymbol: false,
				codeActions: false,
				organizeImports: false,
			});
			for (const maped of interpolations.value.formapMappings) {
				sourceMap.add({
					data: maped.data,
					mode: maped.mode,
					sourceRange: {
						start: maped.sourceRange.start + template.value.loc.start,
						end: maped.sourceRange.end + template.value.loc.start,
					},
					mappedRange: maped.mappedRange,
				});
			}
			return sourceMap;
		}
	});
	const cssTextDocument = computed(() => {
		if (interpolations.value && template.value) {
			const textDocument = TextDocument.create(vueUri + '.template.css', 'css', 0, interpolations.value.cssCode);
			const stylesheet = languageServices.css.parseStylesheet(textDocument);
			return {
				textDocument,
				stylesheet,
				links: [],
				module: false,
				scoped: false,
				ignore: template.value.ignore,
			};
		}
	});
	const cssSourceMap = computed(() => {
		if (interpolations.value && cssTextDocument.value && template.value) {
			const vueDoc = getUnreactiveDoc();
			const sourceMap = new SourceMaps.CssSourceMap(
				vueDoc,
				cssTextDocument.value.textDocument,
				cssTextDocument.value.stylesheet,
				false,
				false,
				[],
				{ foldingRanges: false, formatting: false },
			);
			for (const maped of interpolations.value.cssMappings) {
				sourceMap.add({
					...maped,
					sourceRange: {
						start: maped.sourceRange.start + template.value.loc.start,
						end: maped.sourceRange.end + template.value.loc.start,
					},
					additional: maped.additional ? maped.additional.map(other => ({
						...other,
						sourceRange: {
							start: other.sourceRange.start + template.value!.loc.start,
							end: other.sourceRange.end + template.value!.loc.start,
						},
					})) : undefined,
				});
			}
			return sourceMap;
		}
	});
	const textDocument = ref<TextDocument>();
	const textDocumentForFormatting = ref<TextDocument>();
	const teleportSourceMap = ref<SourceMaps.TeleportSourceMap>();

	return {
		sourceMap,
		textDocument,
		textDocumentForFormatting,
		sourceMapForFormatting,
		teleportSourceMap,
		cssTextDocument,
		cssSourceMap,
		update, // TODO: cheapComputed
	};

	function update() {
		if (data.value?.text !== textDocument.value?.getText()) {
			if (data.value && interpolations.value) {
				const _version = version++;
				textDocument.value = TextDocument.create(vueUri + '.__VLS_template.ts', 'typescript', _version, data.value.text);
				textDocumentForFormatting.value = TextDocument.create(vueUri + '.__VLS_template.format.ts', 'typescript', _version, interpolations.value.formatCode);

				const sourceMap = new SourceMaps.TeleportSourceMap(textDocument.value);
				for (const maped of data.value.ctxMappings) {
					sourceMap.add(maped);
				}
				teleportSourceMap.value = sourceMap;
			}
			else {
				textDocument.value = undefined;
				teleportSourceMap.value = undefined;
				textDocumentForFormatting.value = undefined;
			}
		}
	}
}

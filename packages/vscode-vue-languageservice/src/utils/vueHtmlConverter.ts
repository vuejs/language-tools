import { TemplateChildNode, ElementNode, NodeTypes, RootNode } from '@vue/compiler-core';
import { TransformContext, transformOn } from '@vue/compiler-core';
import { MapedMode, TsMappingData, Mapping, MapedNodeTypes, MapedRange } from './sourceMaps';
import { camelize, hyphenate } from '@vue/shared';
import * as vueDom from '@vue/compiler-dom';

const capabilitiesSet = {
	all: { basic: true, diagnostic: true, references: true, rename: true, completion: true, semanticTokens: true },
	noFormatting: { basic: true, diagnostic: true, references: true, rename: true, completion: true, semanticTokens: true },
	diagnosticOnly: { basic: false, diagnostic: true, references: false, rename: false, completion: true, semanticTokens: false },
	htmlTagOrAttr: { basic: true, diagnostic: true, references: true, rename: true, completion: false, semanticTokens: false },
	className: { basic: true, diagnostic: false, references: true, rename: true, completion: false, semanticTokens: false },
	slotName: { basic: true, diagnostic: true, references: true, rename: false, completion: false, semanticTokens: false},
	slotNameExport: { basic: true, diagnostic: true, references: true, rename: false, completion: false, semanticTokens: false, referencesCodeLens: true },
	propRaw: { basic: false, diagnostic: false, references: true, rename: true, completion: false, semanticTokens: false },
	referencesOnly: { basic: false, diagnostic: false, references: true, rename: false, completion: false, semanticTokens: false },
}

export function transformVueHtml(html: string, componentNames: string[] = [], htmlToTemplate?: (htmlStart: number, htmlEnd: number) => number | undefined, scriptSetupVars?: string[]) {
	let node: vueDom.RootNode;
	try {
		node = vueDom.compile(html, { onError: () => { } }).ast;
	}
	catch {
		return {
			textWithoutSlots: '',
			text: '',
			mappings: [],
			cssCode: '',
			cssMappings: [],
			tags: new Set<string>(),
			formatCode: '',
			formapMappings: [],
		};
	}
	const mappings: Mapping<TsMappingData>[] = [];
	const formapMappings: Mapping<TsMappingData>[] = [];
	const cssMappings: Mapping<undefined>[] = [];
	const tags = new Set<string>();
	const slots = new Map<string, {
		varName: string,
		loc: MapedRange,
	}>();
	const componentsMap = new Map<string, string>();

	for (const componentName of componentNames) {
		componentsMap.set(hyphenate(componentName), componentName);
	}

	let elementIndex = 0;
	let cssCode = '';
	let text = '';
	let formatCode = '';
	parseNode(node, []);

	const textWithoutSlots = text;

	text += `export default {\n`
	for (const [name, slot] of slots) {
		mappingObjectProperty(MapedNodeTypes.Slot, name, capabilitiesSet.slotNameExport, slot.loc);
		text += `: ${slot.varName},\n`;
	}
	text += `};\n`

	return {
		mappings,
		textWithoutSlots,
		text,
		cssMappings,
		cssCode,
		tags,
		formatCode,
		formapMappings,
	};


	function getComponentName(tagName: string) {
		return componentsMap.get(tagName) ?? tagName;
	}
	function parseNode(node: TemplateChildNode | RootNode, parents: (TemplateChildNode | RootNode)[]) {
		if (node.type === NodeTypes.ROOT) {
			for (const childNode of node.children) {
				text += `{\n`;
				text = parseNode(childNode, parents.concat(node));
				text += `}\n`;
			}
		}
		else if (node.type === NodeTypes.ELEMENT) {
			text += `{\n`;
			{
				tags.add(getComponentName(node.tag));

				if (scriptSetupVars) {
					for (const scriptSetupVar of scriptSetupVars) {
						if (node.tag === scriptSetupVar || node.tag === hyphenate(scriptSetupVar)) {
							text += scriptSetupVar + `; // ignore unused in script setup\n`;
						}
					}
				}

				writeInlineCss(node);
				writeImportSlots(node);
				writeVshow(node);
				writeElReferences(node); // <el ref="foo" />
				writeProps(node, false);
				writeProps(node, true);
				writeClassScopeds(node);
				writeOns(node);
				writeOptionReferences(node);
				writeSlots(node);
				for (const childNode of node.children) {
					text = parseNode(childNode, parents.concat(node));
				}
			}
			text += '}\n';

			function writeInlineCss(node: ElementNode) {
				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.name === 'bind'
						&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
						&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
						&& prop.arg.content === 'style'
						&& prop.exp.isConstant
					) {
						const endCrt = prop.arg.loc.source[prop.arg.loc.source.length - 1]; // " | '
						const start = prop.arg.loc.source.indexOf(endCrt) + 1;
						const end = prop.arg.loc.source.lastIndexOf(endCrt);
						const content = prop.arg.loc.source.substring(start, end);
						const sourceRange = {
							start: prop.arg.loc.start.offset + start,
							end: prop.arg.loc.start.offset + end,
						};
						if (htmlToTemplate) {
							const newStart = htmlToTemplate(sourceRange.start, sourceRange.end);
							if (newStart === undefined) continue;
							const offset = newStart - sourceRange.start;
							sourceRange.start += offset;
							sourceRange.end += offset;
						}
						cssCode += `${node.tag} { `;
						cssMappings.push({
							data: undefined,
							mode: MapedMode.Offset,
							sourceRange,
							targetRange: {
								start: cssCode.length,
								end: cssCode.length + content.length,
							},
						});
						cssCode += content;
						cssCode += ` }\n`;
					}
				}
			}
			function writeImportSlots(node: ElementNode) {
				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.name === 'slot'
					) {
						const parent = findParentElement(parents.concat(node));
						if (!parent) continue;

						if (prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
							text += `let `;
							mapping(undefined, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, {
								start: prop.exp.loc.start.offset,
								end: prop.exp.loc.end.offset,
							}, true, ['(', ')']);
							text += ` = `;
						}
						let slotName = 'default';
						if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content !== '') {
							slotName = prop.arg.content;
						}
						const diagStart = text.length;
						text += `__VLS_components['${getComponentName(parent.tag)}'].__VLS_slots`;
						mappingPropertyAccess(MapedNodeTypes.Slot, slotName, capabilitiesSet.slotName, {
							start: prop.arg?.loc.start.offset ?? prop.loc.start.offset,
							end: prop.arg?.loc.end.offset ?? prop.loc.end.offset,
						});
						const diagEnd = text.length;
						mappings.push({
							mode: MapedMode.Gate,
							sourceRange: {
								start: prop.arg?.loc.start.offset ?? prop.loc.start.offset,
								end: prop.arg?.loc.end.offset ?? prop.loc.end.offset,
							},
							targetRange: {
								start: diagStart,
								end: diagEnd,
							},
							data: {
								type: MapedNodeTypes.Slot,
								vueTag: 'template',
								capabilities: capabilitiesSet.diagnosticOnly,
							},
						});
						text += `;\n`;
					}

					function findParentElement(parents: (TemplateChildNode | RootNode)[]): ElementNode | undefined {
						for (const parent of parents.reverse()) {
							if (parent.type === NodeTypes.ELEMENT && parent.tag !== 'template') {
								return parent;
							}
						}
					}
				}
			}
			function writeOptionReferences(node: ElementNode) {
				// fix find references not work if prop has default value
				// fix emits references not work
				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.arg
						&& (!prop.exp || prop.exp.type === NodeTypes.SIMPLE_EXPRESSION)
						&& prop.arg.type === NodeTypes.SIMPLE_EXPRESSION
						&& !prop.exp?.isConstant // ignore style, style='z-index: 2' will compile to {'z-index':'2'}
					) {
						if (prop.name === 'bind' || prop.name === 'model') {
							write('props', prop.arg.content, prop.arg.loc.start.offset, prop.arg.loc.end.offset);
						}
						else if (prop.name === 'on') {
							write('emits', prop.arg.content, prop.arg.loc.start.offset, prop.arg.loc.end.offset);
						}
					}
					else if (
						prop.type === NodeTypes.ATTRIBUTE
					) {
						write('props', prop.name, prop.loc.start.offset, prop.loc.start.offset + prop.name.length);
					}
				}
				function write(option: 'props' | 'emits', propName: string, start: number, end: number) {
					const props = new Set<string>();
					const emits = new Set<string>();
					if (option === 'props') {
						props.add(propName);
						props.add(camelize(propName));
					}
					else if (option === 'emits') {
						emits.add(propName);
						props.add(camelize('on-' + propName));
					}
					for (const name of props.values()) {
						text += `// @ts-ignore\n`;
						text += `__VLS_components['${getComponentName(node.tag)}'].__VLS_options.props`;
						mappingPropertyAccess(MapedNodeTypes.Prop, name, capabilitiesSet.htmlTagOrAttr, {
							start,
							end,
						});
						text += `;\n`;
					}
					for (const name of emits.values()) {
						text += `// @ts-ignore\n`;
						text += `__VLS_components['${getComponentName(node.tag)}'].__VLS_options.emits`;
						mappingPropertyAccess(undefined, name, capabilitiesSet.htmlTagOrAttr, {
							start,
							end,
						});
						text += `;\n`;
					}
				}
			}
			function writeVshow(node: ElementNode) {
				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& !prop.arg
						&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
					) {
						text += `(`;
						mapping(undefined, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, {
							start: prop.exp.loc.start.offset,
							end: prop.exp.loc.end.offset,
						}, true, ['(', ')']);
						text += `);\n`;
					}
				}
			}
			function writeElReferences(node: ElementNode) {
				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.ATTRIBUTE
						&& prop.name === 'ref'
						&& prop.value
					) {
						text += `// @ts-ignore\n`;
						text += `(`;
						mapping(undefined, prop.value.content, MapedMode.Offset, capabilitiesSet.referencesOnly, {
							start: prop.value.loc.start.offset + 1,
							end: prop.value.loc.end.offset - 1,
						});
						text += `);\n`;
					}
				}
			}
			function writeProps(node: ElementNode, forDuplicateClassOrStyleAttr: boolean) {
				const varName = `__VLS_${elementIndex++}`;
				let wrap = false;

				if (!forDuplicateClassOrStyleAttr) {
					addStartWrap();
				}

				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.arg
						&& (!prop.exp || prop.exp.type === NodeTypes.SIMPLE_EXPRESSION)
						&& prop.arg.type === NodeTypes.SIMPLE_EXPRESSION
					) {
						if (forDuplicateClassOrStyleAttr) continue;

						if (!wrap) {
							addStartWrap();
						}

						const propName = hyphenate(prop.arg.content) === prop.arg.content ? camelize(prop.arg.content) : prop.arg.content;
						const propValue = prop.exp?.content ?? 'undefined';
						const propName2 = prop.arg.content;

						if (prop.name === 'bind' || prop.name === 'model') {
							// camelize name
							mapping(undefined, `'${propName}': (${propValue})`, MapedMode.Gate, capabilitiesSet.diagnosticOnly, {
								start: prop.loc.start.offset,
								end: prop.loc.end.offset,
							}, false);
							if (prop.exp?.isConstant) {
								mappingObjectProperty(MapedNodeTypes.Prop, propName, capabilitiesSet.htmlTagOrAttr, {
									start: prop.arg.loc.start.offset,
									end: prop.arg.loc.start.offset + propName2.length, // patch style attr
								});
							}
							else {
								mappingObjectProperty(MapedNodeTypes.Prop, propName, capabilitiesSet.htmlTagOrAttr, {
									start: prop.arg.loc.start.offset,
									end: prop.arg.loc.end.offset,
								});
							}
							text += `: (`;
							if (prop.exp && !prop.exp.isConstant) { // style='z-index: 2' will compile to {'z-index':'2'}
								mapping(undefined, propValue, MapedMode.Offset, capabilitiesSet.all, {
									start: prop.exp.loc.start.offset,
									end: prop.exp.loc.end.offset,
								}, true, ['(', ')'])
							}
							else {
								text += propValue;
							}
							text += `),\n`;
							// original name
							if (propName2 !== propName) {
								mappingObjectProperty(MapedNodeTypes.Prop, propName2, capabilitiesSet.htmlTagOrAttr, {
									start: prop.arg.loc.start.offset,
									end: prop.arg.loc.end.offset,
								});
								text += `: (${propValue}),\n`;
							}
						}
					}
					else if (
						prop.type === NodeTypes.ATTRIBUTE
					) {
						const propName = hyphenate(prop.name) === prop.name ? camelize(prop.name) : prop.name;
						const propValue = prop.value !== undefined ? `\`${prop.value.content.replace(/`/g, '\\`')}\`` : 'true';
						const propName2 = prop.name;
						const isClassOrStyleAttr = ['style', 'class'].includes(propName);

						if (isClassOrStyleAttr !== forDuplicateClassOrStyleAttr) continue;

						if (!wrap) {
							addStartWrap();
						}

						// camelize name
						mapping(undefined, `'${propName}': ${propValue}`, MapedMode.Gate, capabilitiesSet.diagnosticOnly, {
							start: prop.loc.start.offset,
							end: prop.loc.end.offset,
						}, false);
						mappingObjectProperty(MapedNodeTypes.Prop, propName, capabilitiesSet.htmlTagOrAttr, {
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + propName2.length,
						});
						text += `: ${propValue},\n`;
						// original name
						if (propName2 !== propName) {
							mappingObjectProperty(MapedNodeTypes.Prop, propName2, capabilitiesSet.htmlTagOrAttr, {
								start: prop.loc.start.offset,
								end: prop.loc.start.offset + propName2.length,
							});
							text += `: ${propValue},\n`;
						}
					}
					else {
						text += "/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */\n";
					}
				}

				if (wrap) {
					addEndWrap();
				}

				function addStartWrap() {
					wrap = true;
					if (!forDuplicateClassOrStyleAttr) {
						{ // start tag
							text += `__VLS_components`
							mappingPropertyAccess(MapedNodeTypes.ElementTag, getComponentName(node.tag), capabilitiesSet.htmlTagOrAttr, {
								start: node.loc.start.offset + 1,
								end: node.loc.start.offset + 1 + node.tag.length,
							});
							text += `;\n`
						}
						if (!node.isSelfClosing && !htmlToTemplate) { // end tag
							text += `__VLS_components`
							mappingPropertyAccess(MapedNodeTypes.ElementTag, getComponentName(node.tag), capabilitiesSet.htmlTagOrAttr, {
								start: node.loc.end.offset - 1 - node.tag.length,
								end: node.loc.end.offset - 1,
							});
							text += `;\n`
						}

						text += `const `;
						mapping(undefined, varName, MapedMode.Gate, capabilitiesSet.diagnosticOnly, {
							start: node.loc.start.offset + 1,
							end: node.loc.start.offset + 1 + node.tag.length,
						});
						text += `: typeof __VLS_componentProps['${getComponentName(node.tag)}'] = {\n`;
					}
					else {
						text += `// @ts-ignore\n`;
						text += `__VLS_componentProps['${getComponentName(node.tag)}'] = {\n`;
					}
				}
				function addEndWrap() {
					if (!forDuplicateClassOrStyleAttr) {
						text += `}; ${varName};\n`;
					}
					else {
						text += `};\n`;
					}
				}
			}
			function writeClassScopeds(node: ElementNode) {
				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.ATTRIBUTE
						&& prop.name === 'class'
						&& prop.value
					) {
						let startOffset = prop.value.loc.start.offset + 1; // +1 is "
						let tempClassName = '';

						for (const char of (prop.value.content + ' ')) {
							if (char.trim() !== '') {
								tempClassName += char;
							}
							else {
								addClass(tempClassName, startOffset);
								startOffset += tempClassName.length + 1;
								tempClassName = '';
							}
						}

						function addClass(className: string, offset: number) {
							text += `// @ts-ignore\n`;
							text += `__VLS_styleScopedClasses`
							mappingPropertyAccess(MapedNodeTypes.Prop, className, capabilitiesSet.className, {
								start: offset,
								end: offset + className.length,
							});
							text += `;\n`;
						}
					}
				}
			}
			function writeOns(node: ElementNode) {
				// @ts-ignore
				const context: TransformContext = {
					onError: () => { },
					helperString: str => str.toString(),
					cacheHandlers: false,
					prefixIdentifiers: false,
				};

				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.arg
						&& prop.exp
						&& prop.arg.type === NodeTypes.SIMPLE_EXPRESSION
						&& prop.exp.type === NodeTypes.SIMPLE_EXPRESSION
						&& prop.name === 'on'
					) {
						const var_on = `__VLS_${elementIndex++}`;
						const key_1 = prop.arg.content;
						const key_2 = camelize('on-' + key_1);

						text += `let ${var_on}!: { '${key_1}': __VLS_FirstFunction<typeof __VLS_componentProps['${getComponentName(node.tag)}'][`;
						mappingWithQuotes(undefined, key_2, capabilitiesSet.htmlTagOrAttr, {
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						});
						text += `], __VLS_PickEmitFunction<typeof __VLS_componentEmits['${getComponentName(node.tag)}'], '${key_1}'>> };\n`;

						const transformResult = transformOn(prop, node, context);
						for (const prop_2 of transformResult.props) {
							const value = prop_2.value;
							text += `${var_on} = {\n`
							mappingObjectProperty(undefined, key_1, capabilitiesSet.htmlTagOrAttr, {
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							});
							text += `: `;

							if (value.type === NodeTypes.SIMPLE_EXPRESSION) {
								mapping(undefined, value.content, MapedMode.Offset, capabilitiesSet.all, {
									start: value.loc.start.offset,
									end: value.loc.end.offset,
								}, true, ['', '']);
							}
							else if (value.type === NodeTypes.COMPOUND_EXPRESSION) {
								for (const child of value.children) {
									if (typeof child === 'string') {
										text += child;
									}
									else if (typeof child === 'symbol') {
										// ignore
									}
									else if (child.type === NodeTypes.SIMPLE_EXPRESSION) {
										if (child.content === prop.exp.content) {
											mapping(undefined, child.content, MapedMode.Offset, capabilitiesSet.all, {
												start: child.loc.start.offset,
												end: child.loc.end.offset,
											}, true, ['', '']);
										}
										else {
											text += child.content;
										}
									}
								}
							}
							text += `\n};\n`;
						}
					}
				}
			}
			function writeSlots(node: ElementNode) {
				if (node.tag !== 'slot') return;
				const varDefaultBind = `__VLS_${elementIndex++}`;
				const varBinds = `__VLS_${elementIndex++}`;
				const varSlot = `__VLS_${elementIndex++}`;
				const slotName = getSlotName();
				let hasDefaultBind = false;

				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& !prop.arg
						&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
					) {
						hasDefaultBind = true;
						text += `const ${varDefaultBind} = (`;
						mapping(undefined, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, {
							start: prop.exp.loc.start.offset,
							end: prop.exp.loc.end.offset,
						}, true, ['(', ')']);
						text += `);\n`;
						break;
					}
				}

				text += `const ${varBinds} = {\n`;
				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
						&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
					) {
						mappingObjectProperty(MapedNodeTypes.Prop, prop.arg.content, capabilitiesSet.htmlTagOrAttr, {
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						});
						text += `: (`;
						mapping(undefined, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, {
							start: prop.exp.loc.start.offset,
							end: prop.exp.loc.end.offset,
						}, true, ['(', ')']);
						text += `),\n`;
					}
					else if (
						prop.type === NodeTypes.ATTRIBUTE
						&& prop.name !== 'name' // slot name
					) {
						const propValue = prop.value !== undefined ? `\`${prop.value.content.replace(/`/g, '\\`')}\`` : 'true';
						mappingObjectProperty(MapedNodeTypes.Prop, prop.name, capabilitiesSet.htmlTagOrAttr, {
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + prop.name.length
						});
						text += `: (`;
						text += propValue;
						text += `),\n`;
					}
				}
				text += `};\n`;

				if (hasDefaultBind) {
					text += `var ${varSlot}!: typeof ${varDefaultBind} & typeof ${varBinds};\n`
				}
				else {
					text += `var ${varSlot}!: typeof ${varBinds};\n`
				}

				slots.set(slotName, {
					varName: varSlot,
					loc: {
						start: node.loc.start.offset + 1,
						end: node.loc.start.offset + 1 + node.tag.length,
					},
				});

				function getSlotName() {
					for (const prop2 of node.props) {
						if (prop2.name === 'name' && prop2.type === NodeTypes.ATTRIBUTE && prop2.value) {
							if (prop2.value.content === '') {
								return 'default';
							}
							else {
								return prop2.value.content;
							}
						}
					}
					return 'default';
				}
			}
		}
		else if (node.type === NodeTypes.TEXT_CALL) {
			// {{ var }}
			text = parseNode(node.content, parents.concat(node));
		}
		else if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
			// {{ ... }} {{ ... }}
			for (const childNode of node.children) {
				if (typeof childNode === 'object') {
					text = parseNode(childNode as TemplateChildNode, parents.concat(node));
				}
			}
		}
		else if (node.type === NodeTypes.INTERPOLATION) {
			// {{ ... }}
			const context = node.loc.source.substring(2, node.loc.source.length - 2);
			let start = node.loc.start.offset + 2;

			text += `{`;
			mapping(undefined, context, MapedMode.Offset, capabilitiesSet.all, {
				start: start,
				end: start + context.length,
			}, true, ['{', '}']);
			text += `};\n`;
		}
		else if (node.type === NodeTypes.IF) {
			// v-if / v-else-if / v-else
			let firstIf = true;

			for (const branch of node.branches) {
				if (branch.condition) {
					if (branch.condition.type === NodeTypes.SIMPLE_EXPRESSION) {

						const context = branch.condition.content;
						let start = branch.condition.loc.start.offset;

						if (firstIf) {
							firstIf = false;
							text += `if (\n`;
							text += `(`;
							mapping(undefined, context, MapedMode.Offset, capabilitiesSet.all, {
								start: start,
								end: start + context.length,
							}, true, ['(', ')']);
							text += `)\n`;
							text += `) {\n`;
						}
						else {
							text += `else if (\n`;
							text += `(`;
							mapping(undefined, context, MapedMode.Offset, capabilitiesSet.all, {
								start: start,
								end: start + context.length,
							}, true, ['(', ')']);
							text += `)\n`;
							text += `) {\n`;
						}
						for (const childNode of branch.children) {
							text = parseNode(childNode, parents.concat([node, branch]));
						}
						text += '}\n';
					}
				}
				else {
					text += 'else {\n';
					for (const childNode of branch.children) {
						text = parseNode(childNode, parents.concat([node, branch]));
					}
					text += '}\n';
				}
			}
		}
		else if (node.type === NodeTypes.FOR) {
			// v-for
			const source = node.parseResult.source;
			const value = node.parseResult.value;
			const key = node.parseResult.key;
			const index = node.parseResult.index;

			if (value
				&& source.type === NodeTypes.SIMPLE_EXPRESSION
				&& value.type === NodeTypes.SIMPLE_EXPRESSION) {

				let start_value = value.loc.start.offset;
				let start_source = source.loc.start.offset;

				const sourceVarName = `__VLS_${elementIndex++}`;
				// const __VLS_100 = 123;
				// const __VLS_100 = vmValue;
				text += `const ${sourceVarName} = __VLS_getVforSourceType(`;
				mapping(undefined, source.content, MapedMode.Offset, capabilitiesSet.noFormatting, {
					start: start_source,
					end: start_source + source.content.length,
				});
				text += `);\n`;
				text += `for (__VLS_for_key in `;
				mapping(undefined, sourceVarName, MapedMode.Gate, capabilitiesSet.diagnosticOnly, {
					start: source.loc.start.offset,
					end: source.loc.end.offset,
				});
				text += `) {\n`;

				text += `const `;
				mapping(undefined, value.content, MapedMode.Offset, capabilitiesSet.noFormatting, {
					start: start_value,
					end: start_value + value.content.length,
				});
				text += ` = ${sourceVarName}[__VLS_for_key];\n`;

				if (key && key.type === NodeTypes.SIMPLE_EXPRESSION) {
					let start_key = key.loc.start.offset;
					text += `const `;
					mapping(undefined, key.content, MapedMode.Offset, capabilitiesSet.noFormatting, {
						start: start_key,
						end: start_key + key.content.length,
					});
					text += ` = __VLS_getVforKeyType(${sourceVarName});\n`;
				}
				if (index && index.type === NodeTypes.SIMPLE_EXPRESSION) {
					let start_index = index.loc.start.offset;
					text += `const `;
					mapping(undefined, index.content, MapedMode.Offset, capabilitiesSet.noFormatting, {
						start: start_index,
						end: start_index + index.content.length,
					});
					text += ` = __VLS_getVforIndexType(${sourceVarName});\n`;
				}
				for (const childNode of node.children) {
					text = parseNode(childNode, parents.concat(node));
				}
				text += '}\n';
			}
		}
		else if (node.type === NodeTypes.TEXT) {
			// not needed progress
		}
		else if (node.type === NodeTypes.COMMENT) {
			// not needed progress
		}
		else {
			text += `// Unprocessed node type: ${node.type} json: ${JSON.stringify(node.loc)}\n`
		}
		return text;
	};
	function mappingObjectProperty(type: MapedNodeTypes | undefined, mapCode: string, capabilities: TsMappingData['capabilities'], sourceRange: { start: number, end: number }) {
		if (/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(mapCode)) {
			mapping(type, mapCode, MapedMode.Offset, capabilities, sourceRange);
		}
		else {
			mappingWithQuotes(type, mapCode, capabilities, sourceRange);
		}
	}
	function mappingPropertyAccess(type: MapedNodeTypes | undefined, mapCode: string, capabilities: TsMappingData['capabilities'], sourceRange: { start: number, end: number }, addCode = true) {
		if (/^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(mapCode)) {
			if (addCode) text += `.`;
			mapping(type, mapCode, MapedMode.Offset, capabilities, sourceRange, addCode);
		}
		else {
			if (addCode) text += `[`;
			mappingWithQuotes(type, mapCode, capabilities, sourceRange, addCode);
			if (addCode) text += `]`;
		}
	}
	function mappingWithQuotes(type: MapedNodeTypes | undefined, mapCode: string, capabilities: TsMappingData['capabilities'], sourceRange: { start: number, end: number }, addCode = true) {
		mapping(type, `'${mapCode}'`, MapedMode.Gate, {
			...capabilities,
			rename: false,
			formatting: false,
			completion: false,
			semanticTokens: false,
		}, sourceRange, false);
		if (addCode) text += `'`;
		mapping(type, mapCode, MapedMode.Offset, capabilities, sourceRange, addCode);
		if (addCode) text += `'`;
	}
	function mapping(type: MapedNodeTypes | undefined, mapCode: string, mode: MapedMode, capabilities: TsMappingData['capabilities'], sourceRange: { start: number, end: number }, addCode = true, formatWrapper?: [string, string]) {
		if (htmlToTemplate) {
			const newStart = htmlToTemplate(sourceRange.start, sourceRange.end);
			if (newStart !== undefined) {
				const offset = newStart - sourceRange.start;
				sourceRange = {
					start: sourceRange.start + offset,
					end: sourceRange.end + offset,
				};
			}
			else {
				// not found
				return;
			}
		}
		if (formatWrapper) {
			formatCode += formatWrapper[0];
			formapMappings.push({
				mode,
				sourceRange: sourceRange,
				targetRange: {
					start: formatCode.length,
					end: formatCode.length + mapCode.length,
				},
				data: {
					type,
					vueTag: 'template',
					capabilities: {
						formatting: true,
					},
				},
			});
			formatCode += mapCode;
			formatCode += formatWrapper[1];
			formatCode += `;\n`;
		}
		mappings.push({
			mode,
			sourceRange: sourceRange,
			targetRange: {
				start: text.length,
				end: text.length + mapCode.length,
			},
			data: {
				type,
				vueTag: 'template',
				capabilities: capabilities,
			},
		});
		if (addCode) {
			text += mapCode;
		}
	}
};

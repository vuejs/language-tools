import { TemplateChildNode, ElementNode, NodeTypes, RootNode } from '@vue/compiler-core';
import { TransformContext, transformOn } from '@vue/compiler-core';
import { MapedMode, TsMappingData, Mapping, MapedNodeTypes, MapedRange } from './sourceMaps';
import { camelize, hyphenate } from '@vue/shared';

const capabilitiesSet = {
	all: { basic: true, diagnostic: true, formatting: true, references: true, rename: true, completion: true, semanticTokens: true },
	noFormatting: { basic: true, diagnostic: true, formatting: false, references: true, rename: true, completion: true, semanticTokens: true },
	diagnosticOnly: { basic: false, diagnostic: true, formatting: false, references: false, rename: false, completion: true, semanticTokens: false },
	htmlTagOrAttr: { basic: true, diagnostic: true, formatting: false, references: true, rename: true, completion: false, semanticTokens: false },
	slotName: { basic: true, diagnostic: true, formatting: false, references: true, rename: false, completion: false, semanticTokens: false },
	propRaw: { basic: false, diagnostic: false, formatting: false, references: true, rename: true, completion: false, semanticTokens: false },
	referencesOnly: { basic: false, diagnostic: false, formatting: false, references: true, rename: false, completion: false, semanticTokens: false },
}

export function transformVueHtml(node: RootNode, pugMapper?: (code: string, htmlOffset: number) => number | undefined) {
	const mappings: Mapping<TsMappingData>[] = [];
	const cssMappings: Mapping<undefined>[] = [];
	const tags = new Set<string>();
	const slots = new Map<string, {
		varName: string,
		loc: MapedRange,
	}>();
	let elementIndex = 0;
	let cssCode = '';
	let _code = '';
	worker(node, []);

	_code += `export default {\n`
	for (const [name, slot] of slots) {
		mappingWithQuotes(MapedNodeTypes.Slot, name, name, capabilitiesSet.slotName, [slot.loc]);
		_code += `: ${slot.varName},\n`;
	}
	_code += `};\n`

	return {
		mappings: mappings,
		text: _code,
		cssMappings,
		cssCode,
		tags,
	};

	function worker(node: TemplateChildNode | RootNode, parents: (TemplateChildNode | RootNode)[]) {
		if (node.type === NodeTypes.ROOT) {
			for (const childNode of node.children) {
				_code += `{\n`;
				_code = worker(childNode, parents.concat(node));
				_code += `}\n`;
			}
		}
		else if (node.type === NodeTypes.ELEMENT) { // TODO: should not has indent
			_code += `{\n`;
			{
				tags.add(node.tag);
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
					_code = worker(childNode, parents.concat(node));
				}
			}
			_code += '}\n';

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
						if (pugMapper) {
							const newStart = pugMapper(content, sourceRange.start);
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
							_code += `let `;
							mapping(undefined, prop.exp.content, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, [{
								start: prop.exp.loc.start.offset,
								end: prop.exp.loc.end.offset,
							}]);
							_code += ` = `;
						}
						let slotName = 'default';
						if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content !== '') {
							slotName = prop.arg.content;
						}
						const diagStart = _code.length;
						_code += `__VLS_components['${parent.tag}'].__VLS_slots[`;
						mappingWithQuotes(MapedNodeTypes.Slot, slotName, slotName, capabilitiesSet.slotName, [{
							start: prop.arg?.loc.start.offset ?? prop.loc.start.offset,
							end: prop.arg?.loc.end.offset ?? prop.loc.end.offset,
						}]);
						_code += `]`;
						const diagEnd = _code.length;
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
						_code += `;\n`;
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
						&& !prop.exp?.isConstant // TODO: style='z-index: 2' will compile to {'z-index':'2'}
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
					const camelizeName = hyphenate(propName) === propName ? camelize(propName) : propName;
					const originalName = propName;
					const type = option === 'props' ? MapedNodeTypes.Prop : undefined;
					_code += `// @ts-ignore\n`;
					_code += `__VLS_components['${node.tag}'].__VLS_options.${option} = { `;
					mappingWithQuotes(type, camelizeName, originalName, capabilitiesSet.htmlTagOrAttr, [{
						start,
						end,
					}]);
					_code += `: {} as any };\n`;
				}
			}
			function writeVshow(node: ElementNode) {
				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& !prop.arg
						&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
					) {
						_code += `(`;
						mapping(undefined, prop.exp.content, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, [{
							start: prop.exp.loc.start.offset,
							end: prop.exp.loc.end.offset,
						}]);
						_code += `);\n`;
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
						_code += `// @ts-ignore\n`;
						_code += `(`;
						mapping(undefined, prop.value.content, prop.value.content, MapedMode.Offset, capabilitiesSet.referencesOnly, [{
							start: prop.value.loc.start.offset + 1,
							end: prop.value.loc.end.offset - 1,
						}]);
						_code += `);\n`;
					}
				}
			}
			function writeProps(node: ElementNode, forDuplicateClassOrStyleAttr: boolean) {
				// +1 to remove '<' from html tag
				_code += `// forDuplicateClassOrStyleAttr: ${forDuplicateClassOrStyleAttr}\n`;
				const sourceRanges = [{
					start: node.loc.start.offset + 1,
					end: node.loc.start.offset + 1 + node.tag.length,
				}];
				if (!node.isSelfClosing) {
					sourceRanges.push({
						start: node.loc.end.offset - 1 - node.tag.length,
						end: node.loc.end.offset - 1,
					});
				}

				if (!forDuplicateClassOrStyleAttr) {
					mapping(undefined, `__VLS_componentProps['${node.tag}']`, node.tag, MapedMode.Gate, capabilitiesSet.diagnosticOnly, [{
						start: node.loc.start.offset + 1,
						end: node.loc.start.offset + 1 + node.tag.length,
					}], false);
					_code += `__VLS_componentProps[`;
					mappingWithQuotes(MapedNodeTypes.ElementTag, node.tag, node.tag, capabilitiesSet.htmlTagOrAttr, sourceRanges);
					_code += `] = {\n`;
				}
				else {
					_code += `// @ts-ignore\n`;
					_code += `__VLS_componentProps['${node.tag}'] = {\n`;
				}

				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.arg
						&& (!prop.exp || prop.exp.type === NodeTypes.SIMPLE_EXPRESSION)
						&& prop.arg.type === NodeTypes.SIMPLE_EXPRESSION
					) {
						if (forDuplicateClassOrStyleAttr) continue;

						const propName = hyphenate(prop.arg.content) === prop.arg.content ? camelize(prop.arg.content) : prop.arg.content;
						const propValue = prop.exp?.content ?? 'undefined';
						const propName2 = prop.arg.content;

						if (prop.name === 'bind' || prop.name === 'model') {
							// camelize name
							mapping(undefined, `'${propName}': (${propValue})`, prop.loc.source, MapedMode.Gate, capabilitiesSet.diagnosticOnly, [{
								start: prop.loc.start.offset,
								end: prop.loc.end.offset,
							}], false);
							mappingWithQuotes(MapedNodeTypes.Prop, propName, propName2, capabilitiesSet.htmlTagOrAttr, [{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.start.offset + propName2.length, // patch style attr
							}]);
							_code += `: (`;
							if (prop.exp && !prop.exp.isConstant) { // style='z-index: 2' will compile to {'z-index':'2'}
								mapping(undefined, propValue, propValue, MapedMode.Offset, capabilitiesSet.all, [{
									start: prop.exp.loc.start.offset,
									end: prop.exp.loc.end.offset,
								}])
							}
							else {
								_code += propValue;
							}
							_code += `),\n`;
							// original name
							if (propName2 !== propName) {
								mappingWithQuotes(MapedNodeTypes.Prop, propName2, propName2, capabilitiesSet.htmlTagOrAttr, [{
									start: prop.arg.loc.start.offset,
									end: prop.arg.loc.end.offset,
								}]);
								_code += `: (${propValue}),\n`;
							}
						}
					}
					else if (
						prop.type === NodeTypes.ATTRIBUTE
					) {
						const propName = hyphenate(prop.name) === prop.name ? camelize(prop.name) : prop.name;
						const propValue = prop.value ? `\`${prop.value?.content.replace(/`/g, '\\`')}\`` : 'true';
						const propName2 = prop.name;
						const isClassOrStyleAttr = ['style', 'class'].includes(propName);

						if (isClassOrStyleAttr !== forDuplicateClassOrStyleAttr) continue;

						// camelize name
						mapping(undefined, `'${propName}': ${propValue}`, prop.loc.source, MapedMode.Gate, capabilitiesSet.diagnosticOnly, [{
							start: prop.loc.start.offset,
							end: prop.loc.end.offset,
						}], false);
						mappingWithQuotes(MapedNodeTypes.Prop, propName, propName2, capabilitiesSet.htmlTagOrAttr, [{
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + propName2.length,
						}]);
						_code += `: ${propValue},\n`;
						// original name
						if (propName2 !== propName) {
							mappingWithQuotes(MapedNodeTypes.Prop, propName2, propName2, capabilitiesSet.htmlTagOrAttr, [{
								start: prop.loc.start.offset,
								end: prop.loc.start.offset + propName2.length,
							}]);
							_code += `: ${propValue},\n`;
						}
					}
					else {
						_code += "/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */\n";
					}
				}

				_code += '};\n';
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
							const diagStart = _code.length;
							_code += `__VLS_styleScopedClasses[`
							mappingWithQuotes(MapedNodeTypes.Prop, className, className, capabilitiesSet.htmlTagOrAttr, [{
								start: offset,
								end: offset + className.length,
							}]);
							_code += `]`;
							const diagEnd = _code.length;
							mappings.push({
								mode: MapedMode.Gate,
								sourceRange: {
									start: offset,
									end: offset + className.length,
								},
								targetRange: {
									start: diagStart,
									end: diagEnd,
								},
								data: {
									vueTag: 'template',
									capabilities: capabilitiesSet.diagnosticOnly,
								},
							});
							_code += `;\n`;
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

						_code += `let ${var_on}!: { '${key_1}': __VLS_FirstFunction<typeof __VLS_componentEmits['${node.tag}'][`;
						mappingWithQuotes(undefined, key_1, key_1, capabilitiesSet.htmlTagOrAttr, [{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						}]);
						_code += `], typeof __VLS_componentProps['${node.tag}'][`;
						mappingWithQuotes(undefined, key_2, key_1, capabilitiesSet.htmlTagOrAttr, [{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						}]);
						_code += `]> };\n`;

						const transformResult = transformOn(prop, node, context);
						for (const prop_2 of transformResult.props) {
							const value = prop_2.value;
							_code += `${var_on} = {\n`
							mappingWithQuotes(undefined, key_1, key_1, capabilitiesSet.htmlTagOrAttr, [{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							}]);
							_code += `: `;

							if (value.type === NodeTypes.SIMPLE_EXPRESSION) {
								mapping(undefined, value.content, value.content, MapedMode.Offset, capabilitiesSet.all, [{
									start: value.loc.start.offset,
									end: value.loc.end.offset,
								}])
							}
							else if (value.type === NodeTypes.COMPOUND_EXPRESSION) {
								for (const child of value.children) {
									if (typeof child === 'string') {
										_code += child;
									}
									else if (typeof child === 'symbol') {
										// ignore
									}
									else if (child.type === NodeTypes.SIMPLE_EXPRESSION) {
										if (child.content === prop.exp.content) {
											mapping(undefined, child.content, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, [{
												start: child.loc.start.offset,
												end: child.loc.end.offset,
											}])
										}
										else {
											_code += child.content;
										}
									}
								}
							}
							_code += `\n};\n`;
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
						_code += `const ${varDefaultBind} = (`;
						mapping(undefined, prop.exp.content, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, [{ start: prop.exp.loc.start.offset, end: prop.exp.loc.end.offset }]);
						_code += `);\n`;
						break;
					}
				}

				_code += `const ${varBinds} = {\n`;
				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
						&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
					) {
						mappingWithQuotes(MapedNodeTypes.Prop, prop.arg.content, prop.arg.content, capabilitiesSet.htmlTagOrAttr, [{ start: prop.arg.loc.start.offset, end: prop.arg.loc.end.offset }]);
						_code += `: (`;
						mapping(undefined, prop.exp.content, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, [{ start: prop.exp.loc.start.offset, end: prop.exp.loc.end.offset }]);
						_code += `),\n`;
					}
				}
				_code += `};\n`;

				if (hasDefaultBind) {
					_code += `var ${varSlot}!: typeof ${varDefaultBind} & typeof ${varBinds};\n`
				}
				else {
					_code += `var ${varSlot}!: typeof ${varBinds};\n`
				}

				slots.set(slotName, {
					varName: varSlot,
					loc: {
						start: node.loc.start.offset,
						end: node.loc.end.offset,
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
			_code = worker(node.content, parents.concat(node));
		}
		else if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
			// {{ ... }} {{ ... }}
			for (const childNode of node.children) {
				if (typeof childNode === 'object') {
					_code = worker(childNode as TemplateChildNode, parents.concat(node));
				}
			}
		}
		else if (node.type === NodeTypes.INTERPOLATION) {
			// {{ ... }}
			const context = node.loc.source.substring(2, node.loc.source.length - 2);
			let start = node.loc.start.offset + 2;

			_code += `{`;
			mapping(undefined, context, context, MapedMode.Offset, capabilitiesSet.all, [{
				start: start,
				end: start + context.length,
			}]);
			_code += `};\n`;
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
							_code += `if (\n`;
							_code += `(`;
							mapping(undefined, context, context, MapedMode.Offset, capabilitiesSet.all, [{
								start: start,
								end: start + context.length,
							}]);
							_code += `)\n`;
							_code += `) {\n`;
						}
						else {
							_code += `else if (\n`;
							_code += `(`;
							mapping(undefined, context, context, MapedMode.Offset, capabilitiesSet.all, [{
								start: start,
								end: start + context.length,
							}]);
							_code += `)\n`;
							_code += `) {\n`;
						}
						for (const childNode of branch.children) {
							_code = worker(childNode, parents.concat([node, branch]));
						}
						_code += '}\n';
					}
				}
				else {
					_code += 'else {\n';
					for (const childNode of branch.children) {
						_code = worker(childNode, parents.concat([node, branch]));
					}
					_code += '}\n';
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
				_code += `const ${sourceVarName} = __VLS_getVforSourceType(`;
				mapping(undefined, source.content, source.content, MapedMode.Offset, capabilitiesSet.noFormatting, [{
					start: start_source,
					end: start_source + source.content.length,
				}]);
				_code += `);\n`;
				_code += `for (__VLS_for_key in `;
				mapping(undefined, sourceVarName, source.content, MapedMode.Gate, capabilitiesSet.diagnosticOnly, [{
					start: source.loc.start.offset,
					end: source.loc.end.offset,
				}]);
				_code += `) {\n`;

				_code += `const `;
				mapping(undefined, value.content, value.content, MapedMode.Offset, capabilitiesSet.noFormatting, [{
					start: start_value,
					end: start_value + value.content.length,
				}]);
				_code += ` = ${sourceVarName}[__VLS_for_key];\n`;

				if (key && key.type === NodeTypes.SIMPLE_EXPRESSION) {
					let start_key = key.loc.start.offset;
					_code += `const `;
					mapping(undefined, key.content, key.content, MapedMode.Offset, capabilitiesSet.noFormatting, [{
						start: start_key,
						end: start_key + key.content.length,
					}]);
					_code += ` = __VLS_getVforKeyType(${sourceVarName});\n`;
				}
				if (index && index.type === NodeTypes.SIMPLE_EXPRESSION) {
					let start_index = index.loc.start.offset;
					_code += `const `;
					mapping(undefined, index.content, index.content, MapedMode.Offset, capabilitiesSet.noFormatting, [{
						start: start_index,
						end: start_index + index.content.length,
					}]);
					_code += ` = __VLS_getVforIndexType(${sourceVarName});\n`;
				}
				for (const childNode of node.children) {
					_code = worker(childNode, parents.concat(node));
				}
				_code += '}\n';
			}
		}
		else if (node.type === NodeTypes.TEXT) {
			// not needed progress
		}
		else if (node.type === NodeTypes.COMMENT) {
			// not needed progress
		}
		else {
			_code += `// Unprocessed node type: ${node.type} json: ${JSON.stringify(node.loc)}\n`
		}
		return _code;
	};
	function mappingWithQuotes(type: MapedNodeTypes | undefined, mapCode: string, pugSearchCode: string, capabilities: TsMappingData['capabilities'], sourceRanges: { start: number, end: number }[]) {
		mapping(type, `'${mapCode}'`, pugSearchCode, MapedMode.Gate, {
			...capabilities,
			rename: false,
			formatting: false,
			completion: false,
			semanticTokens: false,
		}, sourceRanges, false);
		_code += `'`;
		mapping(type, mapCode, pugSearchCode, MapedMode.Offset, capabilities, sourceRanges);
		_code += `'`;
	}
	function mapping(type: MapedNodeTypes | undefined, mapCode: string, pugSearchCode: string, mode: MapedMode, capabilities: TsMappingData['capabilities'], sourceRanges: { start: number, end: number }[], addCode = true) {
		if (pugMapper) {
			sourceRanges = sourceRanges.map(range => ({ ...range })); // clone
			for (const sourceRange of sourceRanges) {
				const newStart = pugMapper(pugSearchCode, sourceRange.start);
				if (newStart !== undefined) {
					const offset = newStart - sourceRange.start;
					sourceRange.start += offset;
					sourceRange.end += offset;
				}
				else {
					sourceRange.start = -1;
					sourceRange.end = -1;
				}
			}
			sourceRanges = sourceRanges.filter(range => range.start !== -1);
		}
		for (const sourceRange of sourceRanges) {
			mappings.push({
				mode,
				sourceRange: sourceRange,
				targetRange: {
					start: _code.length,
					end: _code.length + mapCode.length,
				},
				data: {
					type,
					vueTag: 'template',
					capabilities: capabilities,
				},
			});
		}
		if (addCode) {
			_code += mapCode;
		}
	}
};

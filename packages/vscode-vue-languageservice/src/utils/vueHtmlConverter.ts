import { TemplateChildNode, ElementNode, NodeTypes, RootNode } from '@vue/compiler-core';
import { createHtmlPugMapper } from '@volar/pug';
import { MapedMode, TsMappingData, Mapping } from './sourceMaps';
import { camelize, hyphenate } from '@vue/shared';

const capabilitiesSet = {
	all: { basic: true, diagnostic: true, formatting: true, references: true, completion: true },
	noFormatting: { basic: true, diagnostic: true, formatting: false, references: true, completion: true },
	diagnosticOnly: { basic: false, diagnostic: true, formatting: false, references: false, completion: true },
	htmlTagOrAttr: { basic: true, diagnostic: true, formatting: false, references: true, completion: false },
}

export function transformVueHtml(pugData: { html: string, pug: string } | undefined, node: RootNode) {
	const mappings: Mapping<TsMappingData>[] = [];
	const tags = new Set<string>();
	const slots = new Map<string, string>();
	let elementIndex = 0;
	const pugMapper = pugData ? createHtmlPugMapper(pugData.pug, pugData.html) : undefined;
	let text = worker('', node, []);

	text += `export default {\n`
	for (const [name, bind] of slots) {
		text += `'${name}': ${bind},\n`;
	}
	text += `};\n`

	return {
		mappings,
		text,
		tags,
	};

	function worker(_code: string, node: TemplateChildNode | RootNode, parents: (TemplateChildNode | RootNode)[], dontCreateBlock = false): string {
		if (node.type === NodeTypes.ROOT) {
			for (const childNode of node.children) {
				_code += `{\n`;
				_code = worker(_code, childNode, parents.concat(node));
				_code += `}\n`;
			}
		}
		else if (node.type === NodeTypes.ELEMENT) { // TODO: should not has indent
			if (!dontCreateBlock) _code += `{\n`;
			{
				// +1 to remove '<' from html tag
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

				tags.add(node.tag);

				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.name === 'slot'
						&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
						// && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION // TODO
					) {
						const parent = findComponentNode(parents.concat(node));
						if (!parent) continue;

						_code += `let `;
						mapping(prop.type, prop.exp.content, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, [{
							start: prop.exp.loc.start.offset,
							end: prop.exp.loc.end.offset,
						}]);
						if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION) {
							_code += ` = __VLS_components['${parent.tag}'].__VLS_slots['${prop.arg.content}'];\n`;
						}
						else if (prop.arg?.type === NodeTypes.COMPOUND_EXPRESSION) {
							_code += ` = __VLS_components['${parent.tag}'].__VLS_slots[${prop.arg.children}];\n`; // TODO
						}
						else {
							_code += ` = __VLS_components['${parent.tag}'].__VLS_slots[''];\n`;
						}
					}

					function findComponentNode(parents: (TemplateChildNode | RootNode)[]): ElementNode | undefined {
						for (const parent of parents) {
							if (parent.type === NodeTypes.ELEMENT) {
								return parent;
							}
						}
					}
				}

				mapping(node.type, `__VLS_componentProps['${node.tag}']`, node.tag, MapedMode.Gate, capabilitiesSet.diagnosticOnly, [{
					start: node.loc.start.offset + 1,
					end: node.loc.start.offset + 1 + node.tag.length,
				}], false);
				_code += `__VLS_componentProps[`;
				mapping(node.type, `'${node.tag}'`, node.tag, MapedMode.Gate, capabilitiesSet.htmlTagOrAttr, sourceRanges, false);
				_code += `'`;
				mapping(node.type, node.tag, node.tag, MapedMode.Offset, capabilitiesSet.htmlTagOrAttr, sourceRanges);
				_code += `'] = {\n`;
				writeProps(node);
				_code += '};\n';

				writeOns(node);
				writeSlots(node);

				for (const childNode of node.children) {
					_code = worker(_code, childNode, parents.concat(node));
				}
			}
			if (!dontCreateBlock) _code += '}\n';

			function writeProps(node: ElementNode) {
				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.arg
						&& (!prop.exp || prop.exp.type === NodeTypes.SIMPLE_EXPRESSION)
						&& prop.arg.type === NodeTypes.SIMPLE_EXPRESSION
						&& !prop.exp?.isConstant // TODO: style='z-index: 2' will compile to {'z-index':'2'}
					) {
						const propName = hyphenate(prop.arg.content) === prop.arg.content ? camelize(prop.arg.content) : prop.arg.content;
						const propValue = prop.exp?.content ?? 'undefined';
						const propName2 = prop.arg.content;

						if (prop.name === 'bind' || prop.name === 'model') {
							// camelize name
							mapping(prop.type, `'${propName}': (${propValue})`, prop.loc.source, MapedMode.Gate, capabilitiesSet.diagnosticOnly, [{
								start: prop.loc.start.offset,
								end: prop.loc.end.offset,
							}], false);
							mapping(prop.arg.type, `'${propName}'`, propName2, MapedMode.Gate, capabilitiesSet.htmlTagOrAttr, [{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							}], false);
							_code += `'`;
							mapping(prop.arg.type, propName, propName2, MapedMode.Offset, capabilitiesSet.htmlTagOrAttr, [{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							}]);
							_code += `': (`;
							if (prop.exp) {
								mapping(prop.exp.type, propValue, propValue, MapedMode.Offset, capabilitiesSet.all, [{
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
								mapping(prop.arg.type, `'${propName2}'`, propName2, MapedMode.Gate, capabilitiesSet.htmlTagOrAttr, [{
									start: prop.arg.loc.start.offset,
									end: prop.arg.loc.end.offset,
								}], false);
								_code += `'`;
								mapping(prop.arg.type, propName2, propName2, MapedMode.Offset, capabilitiesSet.htmlTagOrAttr, [{
									start: prop.arg.loc.start.offset,
									end: prop.arg.loc.end.offset,
								}]);
								_code += `': (${propValue}),\n`;
							}
						}
					}
					else if (
						prop.type === NodeTypes.ATTRIBUTE
					) {
						const propName = hyphenate(prop.name) === prop.name ? camelize(prop.name) : prop.name;
						const propValue = prop.value?.content ?? '';
						const propName2 = prop.name;

						// camelize name
						mapping(prop.type, `'${propName}': "${propValue}"`, prop.loc.source, MapedMode.Gate, capabilitiesSet.diagnosticOnly, [{
							start: prop.loc.start.offset,
							end: prop.loc.end.offset,
						}], false);
						mapping(prop.type, `'${propName}'`, propName2, MapedMode.Gate, capabilitiesSet.htmlTagOrAttr, [{
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + propName2.length,
						}], false);
						_code += `'`;
						mapping(prop.type, propName, propName2, MapedMode.Offset, capabilitiesSet.htmlTagOrAttr, [{
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + propName2.length,
						}]);
						_code += `': "${propValue}",\n`;
						// original name
						if (propName2 !== propName) {
							mapping(prop.type, `'${propName2}'`, propName2, MapedMode.Gate, capabilitiesSet.htmlTagOrAttr, [{
								start: prop.loc.start.offset,
								end: prop.loc.start.offset + propName2.length,
							}], false);
							_code += `'`;
							mapping(prop.type, propName2, propName2, MapedMode.Offset, capabilitiesSet.htmlTagOrAttr, [{
								start: prop.loc.start.offset,
								end: prop.loc.start.offset + propName2.length,
							}]);
							_code += `': "${propValue}",\n`;
						}
					}
					else {
						_code += "//" + [prop.type, prop.name, prop.loc.source].join(", ") + "\n";
					}
				}
			}
			function writeOns(node: ElementNode) {
				for (const prop of node.props) {
					const varName = `__VLS_${elementIndex++}`;
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.arg
						&& (!prop.exp || prop.exp.type === NodeTypes.SIMPLE_EXPRESSION)
						&& prop.arg.type === NodeTypes.SIMPLE_EXPRESSION
						&& !prop.exp?.isConstant // style='z-index: 2' will compile to {'z-index':'2'}
						&& prop.name === 'on'
					) {
						const propName = prop.arg.content;
						const propName2 = 'on' + propName[0].toUpperCase() + propName.substr(1);

						_code += `let ${varName}!: { '${propName}': __VLS_FirstFunction<typeof __VLS_componentEmits['${node.tag}']['${propName}'], typeof __VLS_componentProps['${node.tag}']['${propName2}']> };\n`;
						_code += `${varName} = {\n`
						{
							mapping(prop.arg.type, `'${propName}'`, propName, MapedMode.Gate, capabilitiesSet.htmlTagOrAttr, [{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							}], false);
							_code += `'`;
							mapping(prop.arg.type, propName, propName, MapedMode.Offset, capabilitiesSet.htmlTagOrAttr, [{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							}]);
							_code += `': (`;
							if (prop.exp) {
								mapping(prop.exp.type, prop.exp.content, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, [{
									start: prop.exp.loc.start.offset,
									end: prop.exp.loc.end.offset,
								}])
							}
							else {
								_code += 'undefined';
							}
							_code += `),\n`;
						}
						_code += `};\n`;
					}
				}
			}
			function writeSlots(node: ElementNode) {
				if (node.tag !== 'slot') return;
				const varName = `__VLS_${elementIndex++}`;
				const varName2 = `__VLS_${elementIndex++}`;
				const slotName = getSlotName();

				_code += `const ${varName} = {\n`;

				for (const prop of node.props) {
					if (
						prop.type === NodeTypes.DIRECTIVE
						&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
						&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
					) {
						mapping(node.type, `'${prop.arg.content}'`, prop.exp.content, MapedMode.Gate, capabilitiesSet.htmlTagOrAttr, [{ start: prop.arg.loc.start.offset, end: prop.arg.loc.end.offset }], false);
						_code += `'`;
						mapping(node.type, prop.arg.content, prop.exp.content, MapedMode.Offset, capabilitiesSet.htmlTagOrAttr, [{ start: prop.arg.loc.start.offset, end: prop.arg.loc.end.offset }]);
						_code += `': (`;
						mapping(node.type, prop.exp.content, prop.exp.content, MapedMode.Offset, capabilitiesSet.all, [{ start: prop.exp.loc.start.offset, end: prop.exp.loc.end.offset }]);
						_code += `),\n`;
					}
				}

				_code += `};\n`;
				_code += `var ${varName2}!: typeof ${varName};\n`
				slots.set(slotName, varName2);

				function getSlotName() {
					for (const prop2 of node.props) {
						if (prop2.name === 'name' && prop2.type === NodeTypes.ATTRIBUTE && prop2.value) {
							return prop2.value.content;
						}
					}
					return '';
				}
			}
		}
		else if (node.type === NodeTypes.TEXT_CALL) {
			// {{ var }}
			_code = worker(_code, node.content, parents.concat(node));
		}
		else if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
			// {{ ... }} {{ ... }}
			for (const childNode of node.children) {
				if (typeof childNode === 'object') {
					_code = worker(_code, childNode as TemplateChildNode, parents.concat(node));
				}
			}
		}
		else if (node.type === NodeTypes.INTERPOLATION) {
			// {{ ... }}
			const context = node.loc.source.substring(2, node.loc.source.length - 2);
			let start = node.loc.start.offset + 2;

			_code += `{`;
			mapping(node.type, context, context, MapedMode.Offset, capabilitiesSet.all, [{
				start: start,
				end: start + context.length,
			}]);
			_code += `};\n`;
		}
		else if (node.type === NodeTypes.IF) {
			// v-if / v-else-if / v-else
			let childHasBlock = true;
			if (node.codegenNode) childHasBlock = node.loc.source.substring(1, 9) !== 'template';

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
							mapping(branch.condition.type, context, context, MapedMode.Offset, capabilitiesSet.all, [{
								start: start,
								end: start + context.length,
							}]);
							_code += `)\n`;
							_code += `) {\n`;
						}
						else {
							_code += `else if (\n`;
							_code += `(`;
							mapping(branch.condition.type, context, context, MapedMode.Offset, capabilitiesSet.all, [{
								start: start,
								end: start + context.length,
							}]);
							_code += `)\n`;
							_code += `) {\n`;
						}
						for (const childNode of branch.children) {
							_code = worker(_code, childNode, parents.concat([node, branch]), childHasBlock);
						}
						_code += '}\n';
					}
				}
				else {
					_code += 'else {\n';
					for (const childNode of branch.children) {
						_code = worker(_code, childNode, parents.concat([node, branch]), childHasBlock);
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
			let childHasBlock = true;
			if (node.codegenNode) childHasBlock = node.codegenNode.loc.source.substring(1, 9) !== 'template';

			if (value
				&& source.type === NodeTypes.SIMPLE_EXPRESSION
				&& value.type === NodeTypes.SIMPLE_EXPRESSION) {

				let start_value = value.loc.start.offset;
				let start_source = source.loc.start.offset;

				const sourceVarName = `__VLS_${elementIndex++}`;
				// const __VLS_100 = 123;
				// const __VLS_100 = vmValue;
				_code += `const ${sourceVarName} = __VLS_getVforSourceType(`;
				mapping(source.type, source.content, source.content, MapedMode.Offset, capabilitiesSet.noFormatting, [{
					start: start_source,
					end: start_source + source.content.length,
				}]);
				_code += `);\n`;
				_code += `for (__VLS_for_key in `;
				mapping(source.type, sourceVarName, source.content, MapedMode.Gate, capabilitiesSet.diagnosticOnly, [{
					start: source.loc.start.offset,
					end: source.loc.end.offset,
				}]);
				_code += `) {\n`;

				_code += `const `;
				mapping(value.type, value.content, value.content, MapedMode.Offset, capabilitiesSet.noFormatting, [{
					start: start_value,
					end: start_value + value.content.length,
				}]);
				_code += ` = ${sourceVarName}[__VLS_for_key];\n`;

				if (key && key.type === NodeTypes.SIMPLE_EXPRESSION) {
					let start_key = key.loc.start.offset;
					_code += `const `;
					mapping(key.type, key.content, key.content, MapedMode.Offset, capabilitiesSet.noFormatting, [{
						start: start_key,
						end: start_key + key.content.length,
					}]);
					_code += ` = 0 as any;\n`;
				}
				if (index && index.type === NodeTypes.SIMPLE_EXPRESSION) {
					let start_index = index.loc.start.offset;
					_code += `const `;
					mapping(index.type, index.content, index.content, MapedMode.Offset, capabilitiesSet.noFormatting, [{
						start: start_index,
						end: start_index + index.content.length,
					}]);
					_code += ` = 0;\n`;
				}
				for (const childNode of node.children) {
					_code = worker(_code, childNode, parents.concat(node), childHasBlock);
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

		function mapping(nodeType: NodeTypes, mapCode: string, pugSearchCode: string, mode: MapedMode, capabilities: TsMappingData['capabilities'], sourceRanges: { start: number, end: number }[], addCode = true) {
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
					vueRange: sourceRange,
					virtualRange: {
						start: _code.length,
						end: _code.length + mapCode.length,
					},
					data: {
						vueTag: 'template',
						templateNodeType: nodeType,
						capabilities: capabilities,
					},
				});
			}
			if (addCode) {
				_code += mapCode;
			}
		}
	};
};

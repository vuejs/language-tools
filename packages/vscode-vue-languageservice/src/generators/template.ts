import * as SourceMaps from '../utils/sourceMaps';
import { createCodeGen } from '@volar/code-gen';
import { camelize, hyphenate } from '@vue/shared';
import * as vueDom from '@vue/compiler-dom';
import { NodeTypes, transformOn } from '@vue/compiler-dom';
import type { TemplateChildNode, ElementNode, TransformContext } from '@vue/compiler-dom';
import { processFor } from '@vue/compiler-core';

const capabilitiesSet = {
	all: { basic: true, diagnostic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	noFormatting: { basic: true, diagnostic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	diagnosticOnly: { diagnostic: true, completion: true, },
	tag: { basic: true, diagnostic: true, references: true, definitions: true, rename: true, },
	attr: { basic: true, extraHoverInfo: true, diagnostic: true, references: true, definitions: true, rename: true, },
	scopedClassName: { references: true, definitions: true, rename: true, },
	slotName: { basic: true, diagnostic: true, references: true, definitions: true, completion: true, },
	slotNameExport: { basic: true, diagnostic: true, references: true, definitions: true, referencesCodeLens: true },
	referencesOnly: { references: true, definitions: true, },
}
const formatBrackets = {
	empty: ['', ''] as [string, string],
	round: ['(', ')'] as [string, string],
	curly: ['{', '}'] as [string, string],
	square: ['[', ']'] as [string, string],
};
const validTsVar = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
// @ts-ignore
export const transformContext: TransformContext = {
	onError: () => { },
	helperString: str => str.toString(),
	replaceNode: node => { },
	cacheHandlers: false,
	prefixIdentifiers: false,
	scopes: {
		vFor: 0,
		vOnce: 0,
		vPre: 0,
		vSlot: 0,
	},
};

export function generate(
	html: string,
	componentNames: string[] = [],
	elementNames: string[] = [],
	cssScopedClasses: string[] = [],
	htmlToTemplate?: (htmlStart: number, htmlEnd: number) => number | undefined,
) {

	const tsCodeGen = createCodeGen<SourceMaps.TsMappingData>();
	const tsFormatCodeGen = createCodeGen<SourceMaps.TsMappingData>();
	const cssCodeGen = createCodeGen<undefined>();
	const tags = new Set<string>();
	const slots = new Map<string, {
		varName: string,
		loc: SourceMaps.Range,
	}>();
	const slotExps = new Map<string, {
		varName: string,
		loc: SourceMaps.Range,
	}>();
	const componentsMap = new Map<string, string>();
	const elementNamesSet = new Set(elementNames);
	const cssScopedClassesSet = new Set(cssScopedClasses);

	for (const componentName of componentNames) {
		const variantName = hyphenate(componentName);
		if (!elementNamesSet.has(variantName)) {
			componentsMap.set(variantName, componentName);
		}
	}

	let elementIndex = 0;

	try {
		const templateAst = vueDom.compile(html, { onError: () => { } }).ast;

		for (const childNode of templateAst.children) {
			tsCodeGen.addText(`{\n`);
			visitNode(childNode, undefined);
			tsCodeGen.addText(`}\n`);
		}

		tsCodeGen.addText(`declare const __VLS_slots:\n`);
		for (const [exp, slot] of slotExps) {
			tsCodeGen.addText(`Record<NonNullable<typeof ${exp}>, typeof ${slot.varName}> &\n`);
		}
		tsCodeGen.addText(`{\n`);
		for (const [name, slot] of slots) {
			writeObjectProperty(
				name,
				slot.loc,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.slotNameExport,
				},
			);
			tsCodeGen.addText(`: typeof ${slot.varName},\n`);
		}
		tsCodeGen.addText(`};\n`);
		tsCodeGen.addText(`export default __VLS_slots;\n`);
	}
	catch { }

	return {
		codeGen: tsCodeGen,
		formatCodeGen: tsFormatCodeGen,
		cssCodeGen: cssCodeGen,
		tags,
	};

	function getComponentName(tagName: string) {
		return componentsMap.get(tagName) ?? tagName;
	}
	function visitNode(node: TemplateChildNode, parentEl: vueDom.ElementNode | undefined): void {
		if (node.type === NodeTypes.ELEMENT) {

			// TODO: track https://github.com/vuejs/vue-next/issues/3498
			const forDirective = node.props.find(
				(prop): prop is vueDom.DirectiveNode =>
					prop.type === NodeTypes.DIRECTIVE
					&& prop.name === 'for'
			);
			if (forDirective) {
				node.props = node.props.filter(prop => prop !== forDirective);
				let forNode: vueDom.ForNode | undefined;
				processFor(node, forDirective, transformContext, _forNode => {
					forNode = _forNode;
					return undefined;
				});
				if (forNode) {
					forNode.children = [node];
					visitNode(forNode, parentEl);
					return;
				}
			}

			if (node.tag !== 'template') {
				parentEl = node;
			}

			tags.add(getComponentName(node.tag));
			tsCodeGen.addText(`{\n`);
			{

				writeInlineCss(node);
				if (parentEl) writeImportSlots(node, parentEl);
				writeDirectives(node);
				writeElReferences(node); // <el ref="foo" />
				writeProps(node, true);
				writeProps(node, false);
				writeClassScopeds(node);
				writeEvents(node);
				writeOptionReferences(node);
				writeSlots(node);

				for (const childNode of node.children) {
					visitNode(childNode, parentEl);
				}
			}
			tsCodeGen.addText('}\n');
		}
		else if (node.type === NodeTypes.TEXT_CALL) {
			// {{ var }}
			visitNode(node.content, parentEl);
		}
		else if (node.type === NodeTypes.COMPOUND_EXPRESSION) {
			// {{ ... }} {{ ... }}
			for (const childNode of node.children) {
				if (typeof childNode === 'object') {
					visitNode(childNode as TemplateChildNode, parentEl);
				}
			}
		}
		else if (node.type === NodeTypes.INTERPOLATION) {
			// {{ ... }}
			const context = node.loc.source.substring(2, node.loc.source.length - 2);
			let start = node.loc.start.offset + 2;

			tsCodeGen.addText(`{`);
			writeCode(
				context,
				{
					start: start,
					end: start + context.length,
				},
				SourceMaps.Mode.Offset,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.all,
				},
				formatBrackets.curly,
			);
			tsCodeGen.addText(`};\n`);
		}
		else if (node.type === NodeTypes.IF) {
			// v-if / v-else-if / v-else
			for (let i = 0; i < node.branches.length; i++) {

				const branch = node.branches[i];

				if (i === 0)
					tsCodeGen.addText('if');
				else if (branch.condition)
					tsCodeGen.addText('else if');
				else
					tsCodeGen.addText('else');

				if (branch.condition?.type === NodeTypes.SIMPLE_EXPRESSION) {
					tsCodeGen.addText(` (`);
					writeCode(
						branch.condition.content,
						{
							start: branch.condition.loc.start.offset,
							end: branch.condition.loc.end.offset,
						},
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						formatBrackets.round,
					);
					tsCodeGen.addText(`)`);
				}
				tsCodeGen.addText(` {\n`);
				for (const childNode of branch.children) {
					visitNode(childNode, parentEl);
				}
				tsCodeGen.addText('}\n');
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
				const forOfItemName = `__VLS_${elementIndex++}`;
				// const __VLS_100 = 123;
				// const __VLS_100 = vmValue;
				tsCodeGen.addText(`const ${sourceVarName} = __VLS_getVforSourceType(`);
				writeCode(
					source.content,
					{
						start: start_source,
						end: start_source + source.content.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.noFormatting,
					},
				);
				tsCodeGen.addText(`);\n`);
				tsCodeGen.addText(`for (var ${forOfItemName} of ${sourceVarName}) { }\n`);
				tsCodeGen.addText(`for (const __VLS_${elementIndex++} in `);
				writeCode(
					sourceVarName,
					{
						start: source.loc.start.offset,
						end: source.loc.end.offset,
					},
					SourceMaps.Mode.Totally,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.diagnosticOnly,
					},
				);
				tsCodeGen.addText(`) {\n`);

				tsCodeGen.addText(`const `);
				writeCode(
					value.content,
					{
						start: start_value,
						end: start_value + value.content.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.noFormatting,
					},
				);
				tsCodeGen.addText(` = __VLS_pickNotAny(${forOfItemName}, ${sourceVarName}[__VLS_getVforKeyType(${sourceVarName})]);\n`);

				if (key && key.type === NodeTypes.SIMPLE_EXPRESSION) {
					let start_key = key.loc.start.offset;
					tsCodeGen.addText(`const `);
					writeCode(
						key.content,
						{
							start: start_key,
							end: start_key + key.content.length,
						},
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.noFormatting,
						},
					);
					tsCodeGen.addText(` = __VLS_getVforKeyType(${sourceVarName});\n`);
				}
				if (index && index.type === NodeTypes.SIMPLE_EXPRESSION) {
					let start_index = index.loc.start.offset;
					tsCodeGen.addText(`const `);
					writeCode(
						index.content,
						{
							start: start_index,
							end: start_index + index.content.length,
						},
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.noFormatting,
						},
					);
					tsCodeGen.addText(` = __VLS_getVforIndexType(${sourceVarName});\n`);
				}
				for (const childNode of node.children) {
					visitNode(childNode, parentEl);
				}
				tsCodeGen.addText('}\n');
			}
		}
		else if (node.type === NodeTypes.TEXT) {
			// not needed progress
		}
		else if (node.type === NodeTypes.COMMENT) {
			// not needed progress
		}
		else {
			tsCodeGen.addText(`// Unprocessed node type: ${node.type} json: ${JSON.stringify(node.loc)}\n`);
		}
	};
	function writeInlineCss(node: ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content === 'style'
				&& prop.exp.constType === vueDom.ConstantTypes.CAN_STRINGIFY
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
				cssCodeGen.addText(`${node.tag} { `);
				cssCodeGen.addCode(
					content,
					sourceRange,
					SourceMaps.Mode.Offset,
					undefined,
				);
				cssCodeGen.addText(` }\n`);
			}
		}
	}
	function writeImportSlots(node: ElementNode, parentEl: vueDom.ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.name === 'slot'
			) {
				if (prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
					tsCodeGen.addText(`let `);
					writeCode(
						prop.exp.content,
						{
							start: prop.exp.loc.start.offset,
							end: prop.exp.loc.end.offset,
						},
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						formatBrackets.round,
					);
					tsCodeGen.addText(` = `);
				}
				let slotName = 'default';
				let isStatic = true;
				if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content !== '') {
					isStatic = prop.arg.isStatic;
					slotName = prop.arg.content;
				}
				const diagStart = tsCodeGen.getText().length;
				tsCodeGen.addText(`__VLS_components['${getComponentName(parentEl.tag)}'].__VLS_slots`);
				const argRange = prop.arg
					? {
						start: prop.arg.loc.start.offset,
						end: prop.arg.loc.end.offset,
					} : {
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + prop.loc.source.split('=')[0].length,
					};
				if (isStatic) {
					tsCodeGen.addText(`[`);
					writeCodeWithQuotes(
						slotName,
						argRange,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.slotName,
						},
					);
					tsCodeGen.addText(`]`);
				}
				else {
					tsCodeGen.addText(`[`);
					writeCode(
						slotName,
						{
							start: argRange.start + 1,
							end: argRange.end - 1,
						},
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
					);
					tsCodeGen.addText(`]`);
				}
				const diagEnd = tsCodeGen.getText().length;
				addMapping(tsCodeGen, {
					mappedRange: {
						start: diagStart,
						end: diagEnd,
					},
					sourceRange: argRange,
					mode: SourceMaps.Mode.Totally,
					data: {
						vueTag: 'template',
						capabilities: capabilitiesSet.diagnosticOnly,
					},
				});
				tsCodeGen.addText(`;\n`);
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
				&& !(prop.exp?.constType === vueDom.ConstantTypes.CAN_STRINGIFY) // ignore style, style='z-index: 2' will compile to {'z-index':'2'}
			) {
				if (prop.name === 'bind' || prop.name === 'model') {
					write('props', prop.arg.content, prop.arg.loc.start.offset, prop.arg.loc.end.offset);
				}
				else if (prop.name === 'on') {
					if (prop.arg.content.startsWith('update:')) {
						write('props', prop.arg.content.substr('update:'.length), prop.arg.loc.start.offset + 'update:'.length, prop.arg.loc.end.offset, true);
					}
					else {
						write('emits', prop.arg.content, prop.arg.loc.start.offset, prop.arg.loc.end.offset);
					}
				}
			}
			else if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.name === 'model'
			) {
				write('props', 'modelValue', prop.loc.start.offset, prop.loc.start.offset + 'v-model'.length, false, false);
			}
			else if (
				prop.type === NodeTypes.ATTRIBUTE
			) {
				write('props', prop.name, prop.loc.start.offset, prop.loc.start.offset + prop.name.length);
			}
		}
		function write(option: 'props' | 'emits', propName: string, start: number, end: number, checking = false, rename = true) {
			const props = new Set<string>();
			const emits = new Set<string>();
			if (option === 'props') {
				props.add(propName);
				props.add(camelize(propName));
			}
			else if (option === 'emits') {
				emits.add(propName);
				emits.add(camelize(propName));
				props.add(camelize('on-' + propName));
			}
			for (const name of props.values()) {
				// __VLS_options.props
				if (!checking)
					tsCodeGen.addText(`// @ts-ignore\n`);
				tsCodeGen.addText(`__VLS_components['${getComponentName(node.tag)}'].__VLS_options.props`);
				writePropertyAccess(
					name,
					{
						start,
						end,
					},
					{
						vueTag: 'template',
						capabilities: {
							...capabilitiesSet.attr,
							basic: false,
							rename: rename,
						},
						doRename: keepHyphenateName,
					},
				);
				tsCodeGen.addText(`;\n`);
			}
			for (const name of emits.values()) {
				// __VLS_options.emits
				if (!checking)
					tsCodeGen.addText(`// @ts-ignore\n`);
				tsCodeGen.addText(`__VLS_components['${getComponentName(node.tag)}'].__VLS_options.emits`);
				writePropertyAccess(
					name,
					{
						start,
						end,
					},
					{
						vueTag: 'template',
						capabilities: {
							...capabilitiesSet.attr,
							basic: false,
							rename: rename,
						},
						doRename: keepHyphenateName,
					},
				);
				tsCodeGen.addText(`;\n`);
			}
		}
	}
	function writeDirectives(node: ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.name !== 'slot'
				&& prop.name !== 'model'
				&& prop.name !== 'bind'
				&& !prop.arg
				&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
			) {
				tsCodeGen.addText(`(`);
				writeCode(
					prop.exp.content,
					{
						start: prop.exp.loc.start.offset,
						end: prop.exp.loc.end.offset,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					formatBrackets.round,
				);
				tsCodeGen.addText(`);\n`);
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
				tsCodeGen.addText(`// @ts-ignore\n`);
				tsCodeGen.addText(`(`);
				writeCode(
					prop.value.content,
					{
						start: prop.value.loc.start.offset + 1,
						end: prop.value.loc.end.offset - 1,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.referencesOnly,
					},
				);
				tsCodeGen.addText(`);\n`);
			}
		}
	}
	function writeProps(node: ElementNode, forDirectiveClassOrStyle: boolean) {
		const varName = `__VLS_${elementIndex++}`;

		if (forDirectiveClassOrStyle) {
			tsCodeGen.addText(`__VLS_componentProps['${getComponentName(node.tag)}'] = {\n`);
		}
		else {
			addStartWrap();
		}

		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& (prop.name === 'bind' || prop.name === 'model')
				&& (prop.name === 'model' || prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION)
				&& (!prop.exp || prop.exp.type === NodeTypes.SIMPLE_EXPRESSION)
			) {

				const propName_1 = prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.arg.content : 'modelValue';
				const propName_2 = hyphenate(propName_1) === propName_1 ? camelize(propName_1) : propName_1;
				const propValue = prop.exp?.content ?? 'undefined';
				const isClassOrStyleAttr = ['style', 'class'].includes(propName_2);
				const isDirective = !prop.exp || prop.exp.constType !== vueDom.ConstantTypes.CAN_STRINGIFY;

				if ((isClassOrStyleAttr && isDirective) !== forDirectiveClassOrStyle) {
					continue;
				}

				// camelize name
				const diagStart = tsCodeGen.getText().length;
				// `'${propName}': (${propValue})`
				if (!prop.arg) {
					writeObjectProperty(
						propName_1,
						{
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + 'v-model'.length,
						},
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.attr,
						},
					);
				}
				else if (prop.exp?.constType === vueDom.ConstantTypes.CAN_STRINGIFY) {
					writeObjectProperty(
						propName_2,
						{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.start.offset + propName_1.length, // patch style attr
						},
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.attr,
							doRename: keepHyphenateName,
						},
					);
				}
				else {
					writeObjectProperty(
						propName_2,
						{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						},
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.attr,
							doRename: keepHyphenateName,
						},
					);
				}
				tsCodeGen.addText(`: (`);
				if (prop.exp && !(prop.exp.constType === vueDom.ConstantTypes.CAN_STRINGIFY)) { // style='z-index: 2' will compile to {'z-index':'2'}
					writeCode(
						propValue,
						{
							start: prop.exp.loc.start.offset,
							end: prop.exp.loc.end.offset,
						},
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						formatBrackets.round,
					);
				}
				else {
					tsCodeGen.addText(propValue);
				}
				tsCodeGen.addText(`)`);
				addMapping(tsCodeGen, {
					sourceRange: {
						start: prop.loc.start.offset,
						end: prop.loc.end.offset,
					},
					mappedRange: {
						start: diagStart,
						end: tsCodeGen.getText().length,
					},
					mode: SourceMaps.Mode.Totally,
					data: {
						vueTag: 'template',
						capabilities: capabilitiesSet.diagnosticOnly,
					},
				});
				tsCodeGen.addText(`,\n`);
				// original name
				if (prop.arg && propName_1 !== propName_2) {
					writeObjectProperty(
						propName_1,
						{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						},
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.attr,
							doRename: keepHyphenateName,
						},
					);
					tsCodeGen.addText(`: (${propValue}),\n`);
				}
			}
			else if (
				prop.type === NodeTypes.ATTRIBUTE
			) {
				if (forDirectiveClassOrStyle) {
					continue;
				}

				const propName = hyphenate(prop.name) === prop.name ? camelize(prop.name) : prop.name;
				const propName2 = prop.name;
				const isClassOrStyleAttr = ['style', 'class'].includes(propName);

				if (isClassOrStyleAttr) {
					tsCodeGen.addText(`// @ts-ignore\n`);
				}

				// camelize name
				const diagStart = tsCodeGen.getText().length;
				writeObjectProperty(
					propName,
					{
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + propName2.length,
					},
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.attr,
						doRename: keepHyphenateName,
					},
				);
				tsCodeGen.addText(': ');
				writeAttrValue(prop.value);
				const diagEnd = tsCodeGen.getText().length;
				tsCodeGen.addText(',\n');
				addMapping(tsCodeGen, {
					sourceRange: {
						start: prop.loc.start.offset,
						end: prop.loc.end.offset,
					},
					mappedRange: {
						start: diagStart,
						end: diagEnd,
					},
					mode: SourceMaps.Mode.Totally,
					data: {
						vueTag: 'template',
						capabilities: capabilitiesSet.diagnosticOnly,
					},
				});
				// original name
				if (propName2 !== propName) {
					writeObjectProperty(
						propName2,
						{
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + propName2.length,
						},
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.attr,
							doRename: keepHyphenateName,
						},
					);
					tsCodeGen.addText(': ');
					writeAttrValue(prop.value);
					tsCodeGen.addText(',\n');
				}
			}
			else if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& !prop.arg
				&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
			) {
				if (forDirectiveClassOrStyle) {
					continue;
				}
				tsCodeGen.addText('...(');
				writeCode(
					prop.exp.content,
					{
						start: prop.exp.loc.start.offset,
						end: prop.exp.loc.end.offset,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					formatBrackets.round,
				);
				tsCodeGen.addText('),\n');
			}
			else {
				if (forDirectiveClassOrStyle) {
					continue;
				}
				tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */\n");
			}
		}

		if (forDirectiveClassOrStyle) {
			tsCodeGen.addText(`};\;`)
		}
		else {
			addEndWrap();
		}

		function writeAttrValue(attrNode: vueDom.TextNode | undefined) {
			if (attrNode) {
				tsCodeGen.addText('`');
				let start = attrNode.loc.start.offset;
				let end = attrNode.loc.end.offset;
				if (end - start > attrNode.content.length) {
					start++;
					end--;
				}
				writeCode(
					attrNode.content.replace(/`/g, '\\`'),
					{ start, end },
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all
					},
				);
				tsCodeGen.addText('`');
			}
			else {
				tsCodeGen.addText('true');
			}
		}
		function addStartWrap() {
			{ // start tag
				tsCodeGen.addText(`__VLS_components`);
				writePropertyAccess(
					getComponentName(node.tag),
					{
						start: node.loc.start.offset + node.loc.source.indexOf(node.tag),
						end: node.loc.start.offset + node.loc.source.indexOf(node.tag) + node.tag.length,
					},
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.tag,
						doRename: keepHyphenateName,
					},
				);
				tsCodeGen.addText(`;\n`);
			}
			if (!node.isSelfClosing && !htmlToTemplate) { // end tag
				tsCodeGen.addText(`__VLS_components`);
				writePropertyAccess(
					getComponentName(node.tag),
					{
						start: node.loc.start.offset + node.loc.source.lastIndexOf(node.tag),
						end: node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) + node.tag.length,
					},
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.tag,
						doRename: keepHyphenateName,
					},
				);
				tsCodeGen.addText(`;\n`);
			}

			tsCodeGen.addText(`const `);
			writeCode(
				varName,
				{
					start: node.loc.start.offset + node.loc.source.indexOf(node.tag),
					end: node.loc.start.offset + node.loc.source.indexOf(node.tag) + node.tag.length,
				},
				SourceMaps.Mode.Totally,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.diagnosticOnly,
				},
			);
			tsCodeGen.addText(`: typeof __VLS_componentProps['${getComponentName(node.tag)}'] = {\n`);
		}
		function addEndWrap() {
			tsCodeGen.addText(`}; ${varName};\n`);
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
					tsCodeGen.addText(`// @ts-ignore\n`);
					tsCodeGen.addText(`__VLS_styleScopedClasses`);
					writePropertyAccess(
						className,
						{
							start: offset,
							end: offset + className.length,
						},
						{
							vueTag: 'template',
							capabilities: {
								...capabilitiesSet.scopedClassName,
								displayWithLink: cssScopedClassesSet.has(className),
							},
						},
					);
					tsCodeGen.addText(`;\n`);
				}
			}
		}
	}
	function writeEvents(node: ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
				&& prop.name === 'on'
			) {
				const var_on = `__VLS_${elementIndex++}`;
				let key_1 = prop.arg.content;
				let keyOffset = 0;

				if (prop.arg.content.startsWith('update:')) {
					keyOffset = 'update:'.length;
					key_1 = prop.arg.content.substr(keyOffset);
					tsCodeGen.addText(`let ${var_on}!: { `);
					tsCodeGen.addText(validTsVar.test(key_1) ? key_1 : `'${key_1}'`);
					tsCodeGen.addText(`: ($event: InstanceType<typeof __VLS_components['${getComponentName(node.tag)}']>['$props']['${key_1}']) => void };\n`);
				}
				else {
					const key_2 = camelize('on-' + key_1);
					const key_3 = camelize(key_1);

					tsCodeGen.addText(`let ${var_on}!: { `);
					tsCodeGen.addText(validTsVar.test(key_1) ? key_1 : `'${key_1}'`);
					tsCodeGen.addText(`: __VLS_FirstFunction<\n`);
					if (key_1 !== key_3) {
						tsCodeGen.addText(`__VLS_FirstFunction<\n`);
						tsCodeGen.addText(`__VLS_EmitEvent<typeof __VLS_components['${getComponentName(node.tag)}'], '${key_1}'>,\n`);
						tsCodeGen.addText(`__VLS_EmitEvent<typeof __VLS_components['${getComponentName(node.tag)}'], '${key_3}'>\n`);
						tsCodeGen.addText(`>,\n`);
					}
					else {
						tsCodeGen.addText(`__VLS_EmitEvent<typeof __VLS_components['${getComponentName(node.tag)}'], '${key_1}'>,\n`);
					}
					tsCodeGen.addText(`typeof __VLS_componentProps['${getComponentName(node.tag)}'][`)
					writeCodeWithQuotes(
						key_2,
						{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						},
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.attr,
						},
					);
					tsCodeGen.addText(`]> };\n`);
				}

				const transformResult = transformOn(prop, node, transformContext);
				for (const prop_2 of transformResult.props) {
					const value = prop_2.value;
					tsCodeGen.addText(`${var_on} = {\n`);
					writeObjectProperty(
						key_1,
						{
							start: prop.arg.loc.start.offset + keyOffset,
							end: prop.arg.loc.end.offset,
						},
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.attr,
						},
					);
					tsCodeGen.addText(`: `);

					if (prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
						if (value.type === NodeTypes.SIMPLE_EXPRESSION) {
							if (value.content === prop.exp.content) {
								writeCode(
									value.content,
									{
										start: prop.exp.loc.start.offset,
										end: prop.exp.loc.end.offset,
									},
									SourceMaps.Mode.Offset,
									{
										vueTag: 'template',
										capabilities: capabilitiesSet.all,
									},
									formatBrackets.empty,
								);
							}
							else {
								tsCodeGen.addText(value.content);
							}
						}
						else if (value.type === NodeTypes.COMPOUND_EXPRESSION) {
							for (const child of value.children) {
								if (typeof child === 'string') {
									tsCodeGen.addText(child);
								}
								else if (typeof child === 'symbol') {
									// ignore
								}
								else if (child.type === NodeTypes.SIMPLE_EXPRESSION) {
									if (child.content === prop.exp.content) {
										writeCode(
											child.content,
											{
												start: prop.exp.loc.start.offset,
												end: prop.exp.loc.end.offset,
											},
											SourceMaps.Mode.Offset,
											{
												vueTag: 'template',
												capabilities: capabilitiesSet.all,
											},
											formatBrackets.empty,
										);
									}
									else {
										tsCodeGen.addText(child.content);
									}
								}
							}
						}
					}
					else {
						tsCodeGen.addText(`undefined`);
					}
					tsCodeGen.addText(`\n};\n`);
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
		const slotNameExp = getSlotNameExp();
		let hasDefaultBind = false;

		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& !prop.arg
				&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
			) {
				hasDefaultBind = true;
				tsCodeGen.addText(`const ${varDefaultBind} = (`);
				writeCode(
					prop.exp.content,
					{
						start: prop.exp.loc.start.offset,
						end: prop.exp.loc.end.offset,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					formatBrackets.round,
				);
				tsCodeGen.addText(`);\n`);
				break;
			}
		}

		tsCodeGen.addText(`const ${varBinds} = {\n`);
		for (const prop of node.props) {
			if (
				prop.type === NodeTypes.DIRECTIVE
				&& prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content !== 'name'
			) {
				writeObjectProperty(
					prop.arg.content,
					{
						start: prop.arg.loc.start.offset,
						end: prop.arg.loc.end.offset,
					},
					{
						vueTag: 'template',
						doRename: keepHyphenateName,
						capabilities: capabilitiesSet.attr,
					},
				);
				tsCodeGen.addText(`: (`);
				writeCode(
					prop.exp.content,
					{
						start: prop.exp.loc.start.offset,
						end: prop.exp.loc.end.offset,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					formatBrackets.round,
				);
				tsCodeGen.addText(`),\n`);
			}
			else if (
				prop.type === NodeTypes.ATTRIBUTE
				&& prop.name !== 'name' // slot name
			) {
				const propValue = prop.value !== undefined ? `\`${prop.value.content.replace(/`/g, '\\`')}\`` : 'true';
				writeObjectProperty(
					prop.name,
					{
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + prop.name.length
					},
					{
						vueTag: 'template',
						doRename: keepHyphenateName,
						capabilities: capabilitiesSet.attr,
					},
				);
				tsCodeGen.addText(`: (`);
				tsCodeGen.addText(propValue);
				tsCodeGen.addText(`),\n`);
			}
		}
		tsCodeGen.addText(`};\n`);

		if (hasDefaultBind) {
			tsCodeGen.addText(`var ${varSlot}!: typeof ${varDefaultBind} & typeof ${varBinds};\n`);
		}
		else {
			tsCodeGen.addText(`var ${varSlot}!: typeof ${varBinds};\n`);
		}

		if (slotNameExp) {
			const varSlotExp = `__VLS_${elementIndex++}`;
			const varSlotExp2 = `__VLS_${elementIndex++}`;
			tsCodeGen.addText(`const ${varSlotExp} = ${slotNameExp};\n`);
			tsCodeGen.addText(`var ${varSlotExp2}!: typeof ${varSlotExp};\n`);
			slotExps.set(varSlotExp2, {
				varName: varSlot,
				loc: {
					start: node.loc.start.offset + node.loc.source.indexOf(node.tag),
					end: node.loc.start.offset + node.loc.source.indexOf(node.tag) + node.tag.length,
				},
			});
		}
		else {
			slots.set(slotName, {
				varName: varSlot,
				loc: {
					start: node.loc.start.offset + node.loc.source.indexOf(node.tag),
					end: node.loc.start.offset + node.loc.source.indexOf(node.tag) + node.tag.length,
				},
			});
		}

		function getSlotName() {
			for (const prop2 of node.props) {
				if (prop2.name === 'name' && prop2.type === NodeTypes.ATTRIBUTE && prop2.value) {
					if (prop2.value.content) {
						return prop2.value.content;
					}
				}
			}
			return 'default';
		}
		function getSlotNameExp() {
			for (const prop2 of node.props) {
				if (prop2.type === NodeTypes.DIRECTIVE && prop2.name === 'bind' && prop2.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop2.arg.content === 'name') {
					if (prop2.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
						return prop2.exp.content;
					}
					else {
						return `'default'`;
					}
				}
			}
		}
	}
	function writeObjectProperty(mapCode: string, sourceRange: SourceMaps.Range, data: SourceMaps.TsMappingData) {
		if (validTsVar.test(mapCode)) {
			writeCode(mapCode, sourceRange, SourceMaps.Mode.Offset, data);
		}
		else {
			writeCodeWithQuotes(mapCode, sourceRange, data);
		}
	}
	function writePropertyAccess(mapCode: string, sourceRange: SourceMaps.Range, data: SourceMaps.TsMappingData) {
		if (validTsVar.test(mapCode)) {
			tsCodeGen.addText(`.`);
			return writeCode(mapCode, sourceRange, SourceMaps.Mode.Offset, data);
		}
		else {
			tsCodeGen.addText(`[`);
			writeCodeWithQuotes(mapCode, sourceRange, data);
			tsCodeGen.addText(`]`);
		}
	}
	function writeCodeWithQuotes(mapCode: string, sourceRange: SourceMaps.Range, data: SourceMaps.TsMappingData) {
		const addText = `'${mapCode}'`;
		addMapping(tsCodeGen, {
			sourceRange,
			mappedRange: {
				start: tsCodeGen.getText().length + 1,
				end: tsCodeGen.getText().length + addText.length - 1,
			},
			mode: SourceMaps.Mode.Offset,
			additional: [
				{
					sourceRange,
					mappedRange: {
						start: tsCodeGen.getText().length,
						end: tsCodeGen.getText().length + addText.length,
					},
					mode: SourceMaps.Mode.Totally,
				}
			],
			data,
		});
		tsCodeGen.addText(addText);
	}
	function writeCode(mapCode: string, sourceRange: SourceMaps.Range, mode: SourceMaps.Mode, data: SourceMaps.TsMappingData, formatWrapper?: [string, string]) {
		if (formatWrapper) {
			tsFormatCodeGen.addText(formatWrapper[0]);
			const targetRange = tsFormatCodeGen.addText(mapCode);
			addMapping(tsFormatCodeGen, {
				mappedRange: targetRange,
				sourceRange,
				mode,
				data: {
					vueTag: 'template',
					capabilities: {
						formatting: true,
					},
				},
			});
			tsFormatCodeGen.addText(formatWrapper[1]);
			tsFormatCodeGen.addText(`\n;\n`);
		}
		const targetRange = tsCodeGen.addText(mapCode);
		addMapping(tsCodeGen, {
			sourceRange,
			mappedRange: targetRange,
			mode,
			data,
		});
	}
	function addMapping(gen: typeof tsCodeGen, mapping: SourceMaps.Mapping<SourceMaps.TsMappingData>) {
		const newMapping = { ...mapping };
		if (htmlToTemplate) {

			const templateStart = htmlToTemplate(mapping.sourceRange.start, mapping.sourceRange.end);
			if (templateStart === undefined) return; // not found
			const offset = templateStart - mapping.sourceRange.start;
			newMapping.sourceRange = {
				start: mapping.sourceRange.start + offset,
				end: mapping.sourceRange.end + offset,
			};

			if (mapping.additional) {
				newMapping.additional = [];
				for (const other of mapping.additional) {
					let otherTemplateStart = htmlToTemplate(other.sourceRange.start, other.sourceRange.end);
					if (otherTemplateStart === undefined) continue;
					const otherOffset = otherTemplateStart - other.sourceRange.start;
					newMapping.additional.push({
						...other,
						sourceRange: {
							start: other.sourceRange.start + otherOffset,
							end: other.sourceRange.end + otherOffset,
						},
					})
				}
			}
		}
		gen.addMapping2(newMapping);
	}
};

function keepHyphenateName(oldName: string, newName: string) {
	if (oldName === hyphenate(oldName)) {
		return hyphenate(newName);
	}
	return newName
}

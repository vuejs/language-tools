import * as SourceMaps from '../utils/sourceMaps';
import { createCodeGen } from '@volar/code-gen';
import { camelize, hyphenate, isHTMLTag, isSVGTag } from '@vue/shared';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerCore from '@vue/compiler-core';
import { SearchTexts } from '../utils/string';
import * as shared from '@volar/shared';

const capabilitiesSet = {
	all: { basic: true, diagnostic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	noDiagnostic: { basic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	diagnosticOnly: { diagnostic: true, completion: true, },
	tagHover: { basic: true },
	event: { basic: true, diagnostic: true },
	tagReference: { references: true, definitions: true, rename: true, },
	attr: { basic: true, extraHoverInfo: true, diagnostic: true, references: true, definitions: true, rename: true, },
	scopedClassName: { references: true, definitions: true, rename: true, },
	slotName: { basic: true, diagnostic: true, references: true, definitions: true, completion: true, },
	slotNameExport: { basic: true, diagnostic: true, references: true, definitions: true, referencesCodeLens: true },
	refAttr: { references: true, definitions: true, rename: true, },
}
const formatBrackets = {
	empty: ['', ''] as [string, string],
	round: ['(', ')'] as [string, string],
	curly: ['{', '}'] as [string, string],
	square: ['[', ']'] as [string, string],
};
const validTsVar = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
// @ts-ignore
export const transformContext: CompilerDOM.TransformContext = {
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
	expressionPlugins: ['typescript'],
};

export function generate(
	sourceLang: 'html' | 'pug',
	templateAst: CompilerDOM.RootNode,
	isVue2: boolean,
	cssScopedClasses: string[] = [],
	htmlToTemplate: (htmlStart: number, htmlEnd: number) => number | undefined,
	isScriptSetup: boolean,
) {

	const tsCodeGen = createCodeGen<SourceMaps.TsMappingData>();
	const tsFormatCodeGen = createCodeGen<SourceMaps.TsMappingData>();
	const cssCodeGen = createCodeGen<undefined>();
	const attrNames = new Set<string>();
	const slots = new Map<string, {
		varName: string,
		loc: SourceMaps.Range,
	}>();
	const slotExps = new Map<string, {
		varName: string,
		loc: SourceMaps.Range,
	}>();
	const cssScopedClassesSet = new Set(cssScopedClasses);
	const tags: Record<string, {
		offsets: number[],
		props: Record<string, {
			argName: string,
			offsets: number[],
		}>,
		events: Record<string, {
			offsets: number[],
		}>,
	}> = {};
	const tagResolves: Record<string, {
		name: string,
		rawComponent: string,
		baseProps: string,
		emit: string,
		events: Record<string, string>,
		offsets: number[],
	}> = {};

	let elementIndex = 0;

	for (const childNode of templateAst.children) {
		collectTags(childNode);
	}
	for (const tag in tags) {
		const var_correctTagName = `__VLS_${elementIndex++}`;
		const var_wrapComponent = `__VLS_${elementIndex++}`;
		const var_rawComponent = `__VLS_${elementIndex++}`;
		const var_baseProps = `__VLS_${elementIndex++}`;
		const var_emit = `__VLS_${elementIndex++}`;
		const var_events: Record<string, string> = {};

		tsCodeGen.addText(`declare const ${var_correctTagName}: __VLS_GetComponentName<typeof __VLS_rawComponents, '${tag}'>;\n`);
		tsCodeGen.addText(`declare const ${var_wrapComponent}: __VLS_GetProperty<typeof __VLS_wrapComponents, typeof ${var_correctTagName}, any>;\n`);
		tsCodeGen.addText(`declare const ${var_rawComponent}: __VLS_GetProperty<typeof __VLS_rawComponents, typeof ${var_correctTagName}, any>;\n`);
		tsCodeGen.addText(`declare const ${var_baseProps}: __VLS_ExtractComponentProps<typeof ${var_rawComponent}>;\n`);
		tsCodeGen.addText(`declare const ${var_emit}: __VLS_ExtractEmit2<typeof ${var_rawComponent}>;\n`);

		const resolvedTag = tags[tag];
		const tagRanges = resolvedTag.offsets.map(offset => ({ start: offset, end: offset + tag.length }));

		for (const eventName in resolvedTag.events) {

			const var_on = `__VLS_${elementIndex++}`;
			const event = resolvedTag.events[eventName];
			const key_1 = eventName; // click-outside
			const key_2 = camelize('on-' + key_1); // onClickOutside
			const key_3 = camelize(key_1); // clickOutside

			tsCodeGen.addText(`declare let ${var_on}: { `);
			tsCodeGen.addText(validTsVar.test(key_1) ? key_1 : `'${key_1}'`);
			tsCodeGen.addText(`: __VLS_FillingEventArg<__VLS_FirstFunction<\n`);
			if (key_1 !== key_3) {
				tsCodeGen.addText(`__VLS_FirstFunction<\n`);
				tsCodeGen.addText(`__VLS_EmitEvent<typeof ${var_rawComponent}, '${key_1}'>,\n`);
				tsCodeGen.addText(`__VLS_EmitEvent<typeof ${var_rawComponent}, '${key_3}'>\n`);
				tsCodeGen.addText(`>,\n`);
			}
			else {
				tsCodeGen.addText(`__VLS_EmitEvent<typeof ${var_rawComponent}, '${key_1}'>,\n`);
			}
			tsCodeGen.addText(`(typeof ${var_baseProps} & Omit<__VLS_GlobalAttrs, keyof typeof ${var_baseProps}> & Record<string, unknown>)[`);
			writeCodeWithQuotes(
				key_2,
				event.offsets.map(offset => ({ start: offset, end: offset + eventName.length })),
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.attr,
					beforeRename(newName) {
						return camelize('on-' + newName);
					},
					doRename(oldName, newName) {
						const hName = hyphenate(newName);
						if (hyphenate(newName).startsWith('on-')) {
							return camelize(hName.substr('on-'.length));
						}
						return newName;
					},
				},
			);
			tsCodeGen.addText(`]>>\n};\n`);

			var_events[eventName] = var_on;
		}

		const name1 = tag; // hello-world
		const name2 = camelize(tag); // helloWorld
		const name3 = name2[0].toUpperCase() + name2.substr(1); // HelloWorld
		const componentNames = new Set([name1, name2, name3]);

		if (!isScriptSetup) {
			tsCodeGen.addText(`// @ts-ignore\n`)
			for (const name of componentNames) {
				if (validTsVar.test(name)) {
					tsCodeGen.addText(`${name}; `);
				}
			}
			tsCodeGen.addText(`// ignore unused in setup returns\n`)
		}

		tsCodeGen.addText(`// @ts-ignore\n`);
		tsCodeGen.addText(`({ `);
		writeObjectProperty2(
			tag,
			tagRanges,
			{
				vueTag: 'template',
				capabilities: capabilitiesSet.tagHover,
			},
		);
		tsCodeGen.addText(`: {} as `);
		tsCodeGen.addText(`__VLS_PickNotAny<`.repeat(componentNames.size - 1));
		const names = [...componentNames];
		for (let i = 0; i < names.length; i++) {
			if (i > 0) {
				tsCodeGen.addText(', ');
			}
			tsCodeGen.addText(`typeof __VLS_rawComponents`);
			writePropertyAccess2(
				names[i],
				tagRanges,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.tagReference,
					beforeRename: tag === names[i] ? undefined : unHyphenatComponentName,
					doRename: keepHyphenateName,
				},
			);
			if (i > 0) {
				tsCodeGen.addText('>');
			}
		}
		tsCodeGen.addText(` });\n`);

		writeOptionReferences();

		/* Completion */
		tsCodeGen.addText('/* Completion: Emits */\n');
		for (const name of componentNames) {
			tsCodeGen.addText('// @ts-ignore\n');
			tsCodeGen.addText(`${var_emit}('${SearchTexts.EmitCompletion(name)}');\n`);
		}
		tsCodeGen.addText('/* Completion: Props */\n');
		for (const name of componentNames) {
			tsCodeGen.addText(`${var_baseProps}.${SearchTexts.PropsCompletion(name)};\n`);
		}

		tagResolves[tag] = {
			name: var_correctTagName,
			rawComponent: var_rawComponent,
			baseProps: var_baseProps,
			emit: var_emit,
			events: var_events,
			offsets: tags[tag].offsets.map(offset => htmlToTemplate(offset, offset)).filter(shared.notEmpty),
		};

		function writeOptionReferences() {
			// fix find references not work if prop has default value
			// fix emits references not work
			for (const propName in resolvedTag.props) {

				const prop = resolvedTag.props[propName];
				const propNames = new Set<string>();
				propNames.add(propName);
				propNames.add(camelize(propName));

				for (const name of propNames.values()) {
					// __VLS_options.props
					tsCodeGen.addText(`// @ts-ignore\n`);
					tsCodeGen.addText(`${var_wrapComponent}.__VLS_options.props`);
					writePropertyAccess2(
						name,
						prop.offsets.map(offset => ({ start: offset, end: offset + prop.argName.length })),
						{
							vueTag: 'template',
							capabilities: {
								...capabilitiesSet.attr,
								basic: false,
								rename: propName === prop.argName,
							},
							beforeRename: camelize,
							doRename: keepHyphenateName,
						},
					);
					tsCodeGen.addText(`;\n`);
				}
			}
			for (const eventName in resolvedTag.events) {

				const event = resolvedTag.events[eventName];
				const eventNames = new Set<string>();
				const propNames = new Set<string>();
				eventNames.add(eventName);
				eventNames.add(camelize(eventName));
				propNames.add(camelize('on-' + eventName));

				for (const name of eventNames.values()) {
					// __VLS_options.emits
					tsCodeGen.addText(`// @ts-ignore\n`);
					tsCodeGen.addText(`${var_wrapComponent}.__VLS_options.emits`);
					writePropertyAccess2(
						name,
						event.offsets.map(offset => ({ start: offset, end: offset + eventName.length })),
						{
							vueTag: 'template',
							capabilities: {
								...capabilitiesSet.attr,
								basic: false,
								rename: true,
							},
							beforeRename: camelize,
							doRename: keepHyphenateName,
						},
					);
					tsCodeGen.addText(`;\n`);
				}
				for (const name of propNames.values()) {
					// __VLS_options.props
					tsCodeGen.addText(`// @ts-ignore\n`);
					tsCodeGen.addText(`${var_wrapComponent}.__VLS_options.props`);
					writePropertyAccess2(
						name,
						event.offsets.map(offset => ({ start: offset, end: offset + eventName.length })),
						{
							vueTag: 'template',
							capabilities: {
								...capabilitiesSet.attr,
								basic: false,
								rename: true,
							},
							beforeRename(newName) {
								return camelize('on-' + newName);
							},
							doRename(oldName, newName) {
								const hName = hyphenate(newName);
								if (hyphenate(newName).startsWith('on-')) {
									return camelize(hName.substr('on-'.length));
								}
								return newName;
							},
						},
					);
					tsCodeGen.addText(`;\n`);
				}
			}
		}
	}

	for (const childNode of templateAst.children) {
		tsCodeGen.addText(`{\n`);
		visitNode(childNode, undefined);
		tsCodeGen.addText(`}\n`);
	}

	tsCodeGen.addText(`declare var __VLS_slots:\n`);
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

	return {
		codeGen: tsCodeGen,
		formatCodeGen: tsFormatCodeGen,
		cssCodeGen: cssCodeGen,
		tagNames: tagResolves,
		attrNames,
	};

	function collectTags(node: CompilerDOM.TemplateChildNode) {
		if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
			const patchForNode = getPatchForSlotNode(node);
			if (patchForNode) {
				collectTags(patchForNode);
				return;
			}
			if (!tags[node.tag]) {
				tags[node.tag] = {
					offsets: [],
					props: {},
					events: {},
				};
			}
			const resolvedTag = tags[node.tag];
			resolvedTag.offsets.push(node.loc.start.offset + node.loc.source.indexOf(node.tag)); // start tag
			if (!node.isSelfClosing && sourceLang === 'html') {
				resolvedTag.offsets.push(node.loc.start.offset + node.loc.source.lastIndexOf(node.tag)); // end tag
			}
			for (const prop of node.props) {
				if (
					prop.type === CompilerDOM.NodeTypes.DIRECTIVE
					&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					&& prop.arg.isStatic
				) {

					let propName = prop.arg.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY
						? prop.arg.content
						: prop.arg.loc.source

					if (prop.modifiers.some(m => m === 'prop')) {
						propName = propName.substr(1);
					}

					if (prop.name === 'bind' || prop.name === 'model') {
						addProp(propName, propName, prop.arg.loc.start.offset);
					}
					else if (prop.name === 'on') {
						addEvent(propName, prop.arg.loc.start.offset);
					}
				}
				else if (
					prop.type === CompilerDOM.NodeTypes.DIRECTIVE
					&& !prop.arg
					&& prop.name === 'model'
				) {
					addProp(getModelValuePropName(node, isVue2), 'v-model', prop.loc.start.offset);
				}
				else if (
					prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				) {
					addProp(prop.name, prop.name, prop.loc.start.offset);
				}
			}
			for (const childNode of node.children) {
				collectTags(childNode);
			}

			function addProp(propName: string, argName: string, offset: number) {
				if (!resolvedTag.props[propName]) {
					resolvedTag.props[propName] = {
						argName,
						offsets: [],
					};
				}
				resolvedTag.props[propName].offsets.push(offset);
			}
			function addEvent(eventName: string, offset: number) {
				if (!resolvedTag.events[eventName]) {
					resolvedTag.events[eventName] = {
						offsets: [],
					};
				}
				resolvedTag.events[eventName].offsets.push(offset);
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			// v-if / v-else-if / v-else
			for (let i = 0; i < node.branches.length; i++) {
				const branch = node.branches[i];
				for (const childNode of branch.children) {
					collectTags(childNode);
				}
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.FOR) {
			// v-for
			for (const childNode of node.children) {
				collectTags(childNode);
			}
		}
	}
	function visitNode(node: CompilerDOM.TemplateChildNode, parentEl: CompilerDOM.ElementNode | undefined): void {
		if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
			visitElementNode(node, parentEl);
		}
		else if (node.type === CompilerDOM.NodeTypes.TEXT_CALL) {
			// {{ var }}
			visitNode(node.content, parentEl);
		}
		else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
			// {{ ... }} {{ ... }}
			for (const childNode of node.children) {
				if (typeof childNode === 'object') {
					visitNode(childNode as CompilerDOM.TemplateChildNode, parentEl);
				}
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
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
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			// v-if / v-else-if / v-else
			for (let i = 0; i < node.branches.length; i++) {

				const branch = node.branches[i];

				if (i === 0)
					tsCodeGen.addText('if');
				else if (branch.condition)
					tsCodeGen.addText('else if');
				else
					tsCodeGen.addText('else');

				if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
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
		else if (node.type === CompilerDOM.NodeTypes.FOR) {
			// v-for
			const source = node.parseResult.source;
			const value = node.parseResult.value;
			const key = node.parseResult.key;
			const index = node.parseResult.index;

			if (value
				&& source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& value.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {

				let start_value = value.loc.start.offset;
				let start_source = source.loc.start.offset;

				const sourceVarName = `__VLS_${elementIndex++}`;
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
						capabilities: capabilitiesSet.all,
					},
					formatBrackets.round,
				);
				tsCodeGen.addText(`);\n`);
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
						capabilities: capabilitiesSet.all,
					},
					formatBrackets.empty,
				);
				tsCodeGen.addText(` = __VLS_pickForItem(${sourceVarName}, ${sourceVarName}[__VLS_getVforKeyType(${sourceVarName})]);\n`);

				if (key && key.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
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
							capabilities: capabilitiesSet.all,
						},
						formatBrackets.empty,
					);
					tsCodeGen.addText(` = __VLS_getVforKeyType(${sourceVarName});\n`);
				}
				if (index && index.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
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
							capabilities: capabilitiesSet.all,
						},
						formatBrackets.empty,
					);
					tsCodeGen.addText(` = __VLS_getVforIndexType(${sourceVarName});\n`);
				}
				for (const childNode of node.children) {
					visitNode(childNode, parentEl);
				}
				tsCodeGen.addText('}\n');
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.TEXT) {
			// not needed progress
		}
		else if (node.type === CompilerDOM.NodeTypes.COMMENT) {
			// not needed progress
		}
		else {
			tsCodeGen.addText(`// Unprocessed node type: ${node.type} json: ${JSON.stringify(node.loc)}\n`);
		}
	};
	function visitElementNode(node: CompilerDOM.ElementNode, parentEl: CompilerDOM.ElementNode | undefined) {

		const patchForNode = getPatchForSlotNode(node);
		if (patchForNode) {
			visitNode(patchForNode, parentEl);
			return;
		}

		if (node.tag !== 'template') {
			parentEl = node;
		}

		tsCodeGen.addText(`{\n`);
		{

			const tagText = isHTMLTag(node.tag) || isSVGTag(node.tag) ? node.tag : tagResolves[node.tag].rawComponent;
			tsCodeGen.addText(`<`);
			writeCode(
				tagText,
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
			tsCodeGen.addText(` `);
			const { hasRemainStyleOrClass } = writeProps(node, false);
			tsCodeGen.addText(`/>\n`);

			if (hasRemainStyleOrClass) {
				tsCodeGen.addText(`<${tagText} `);
				writeProps(node, true);
				tsCodeGen.addText(`/>\n`);
			}

			writeInlineCss(node);
			if (parentEl) writeImportSlots(node, parentEl);
			writeDirectives(node);
			writeElReferences(node); // <el ref="foo" />
			if (cssScopedClasses.length) writeClassScopeds(node);
			writeEvents(node);
			writeSlots(node);

			for (const childNode of node.children) {
				visitNode(childNode, parentEl);
			}
		}
		tsCodeGen.addText(`}\n`);

		function writeEvents(node: CompilerDOM.ElementNode) {
			for (const prop of node.props) {
				if (
					prop.type === CompilerDOM.NodeTypes.DIRECTIVE
					&& prop.name === 'on'
					&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				) {

					const transformResult = CompilerDOM.transformOn(prop, node, transformContext);
					for (const prop_2 of transformResult.props) {
						tsCodeGen.addText(`${tagResolves[node.tag].events[prop.arg.loc.source]} = { `);
						writeObjectProperty(
							prop.arg.loc.source,
							{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							},
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.event,
							},
						);
						tsCodeGen.addText(`: `);
						appendExpressionNode(prop, prop_2.value);
						tsCodeGen.addText(` };\n`);
					}
				}
				else if (
					prop.type === CompilerDOM.NodeTypes.DIRECTIVE
					&& prop.name === 'on'
					&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				) {
					// for vue 2 nameless event
					// https://github.com/johnsoncodehk/vue-tsc/issues/67
					tsCodeGen.addText(`$event => {(\n`);
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
						formatBrackets.empty,
					);
					tsCodeGen.addText(`\n)};\n`);
				}

				function appendExpressionNode(prop: CompilerDOM.DirectiveNode, jsChildNode: CompilerDOM.JSChildNode) {
					if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
						if (jsChildNode.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
							appendSimpleExpressionNode(jsChildNode, prop.exp);
						}
						else if (jsChildNode.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
							appendCompoundExpressionNode(jsChildNode, prop.exp);
						}
					}
					else {
						tsCodeGen.addText(`undefined`);
					}
				}
				function appendCompoundExpressionNode(node: CompilerDOM.CompoundExpressionNode, exp: CompilerDOM.SimpleExpressionNode) {
					for (const child of node.children) {
						if (typeof child === 'string') {
							tsCodeGen.addText(child);
						}
						else if (typeof child === 'symbol') {
							// ignore
						}
						else if (child.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
							appendSimpleExpressionNode(child, exp);
						}
					}
				}
				function appendSimpleExpressionNode(node: CompilerDOM.SimpleExpressionNode, exp: CompilerDOM.SimpleExpressionNode) {
					if (node.content === exp.content) {
						writeCode(
							node.content,
							{
								start: exp.loc.start.offset,
								end: exp.loc.end.offset,
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
						tsCodeGen.addText(node.content);
					}
				}
			}
		}
		function writeProps(node: CompilerDOM.ElementNode, forRemainStyleOrClass: boolean) {

			let styleCount = 0;
			let classCount = 0;

			for (const prop of node.props) {
				if (
					prop.type === CompilerDOM.NodeTypes.DIRECTIVE
					&& (prop.name === 'bind' || prop.name === 'model')
					&& (prop.name === 'model' || prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
					&& (!prop.exp || prop.exp.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
				) {

					const isStatic = !prop.arg || (prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic);
					let propName_1 =
						prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
							? prop.arg.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY
								? prop.arg.content
								: prop.arg.loc.source
							: getModelValuePropName(node, isVue2);

					if (prop.modifiers.some(m => m === 'prop')) {
						propName_1 = propName_1.substr(1);
					}

					const propName_2 = !isStatic ? propName_1 : hyphenate(propName_1) === propName_1 ? camelize(propName_1) : propName_1;
					const propValue = prop.exp?.content ?? 'undefined';

					if (forRemainStyleOrClass && propName_2 !== 'style' && propName_2 !== 'class')
						continue;

					if (propName_2 === 'style' || propName_2 === 'class') {
						const index = propName_2 === 'style' ? styleCount++ : classCount++;
						if (index >= 1 !== forRemainStyleOrClass)
							continue;
					}

					if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
						attrNames.add(prop.arg.content);
					}

					// camelize name
					const diagStart = tsCodeGen.getText().length;
					if (!prop.arg) {
						writeCode(
							propName_1,
							{
								start: prop.loc.start.offset,
								end: prop.loc.start.offset + 'v-model'.length,
							},
							SourceMaps.Mode.Offset,
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.attr,
							},
						);
					}
					else if (prop.exp?.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
						writeCode(
							propName_2,
							{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.start.offset + propName_1.length, // patch style attr
							},
							SourceMaps.Mode.Offset,
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.attr,
								beforeRename: camelize,
								doRename: keepHyphenateName,
							},
						);
					}
					else {
						writeCode(
							propName_2,
							{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							},
							SourceMaps.Mode.Offset,
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.attr,
								beforeRename: camelize,
								doRename: keepHyphenateName,
							},
						);
					}
					tsCodeGen.addText(`={`);
					if (prop.exp && !(prop.exp.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY)) { // style='z-index: 2' will compile to {'z-index':'2'}
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
					tsCodeGen.addText(`}`);
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
					tsCodeGen.addText(` `);
					// original name
					if (prop.arg && propName_1 !== propName_2) {
						writeCode(
							propName_1,
							{
								start: prop.arg.loc.start.offset,
								end: prop.arg.loc.end.offset,
							},
							SourceMaps.Mode.Offset,
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.attr,
								beforeRename: camelize,
								doRename: keepHyphenateName,
							},
						);
						tsCodeGen.addText(`={${propValue}} `);
					}
				}
				else if (
					prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				) {

					const propName = hyphenate(prop.name) === prop.name ? camelize(prop.name) : prop.name;
					const propName2 = prop.name;

					if (forRemainStyleOrClass && propName !== 'style' && propName !== 'class')
						continue;

					if (propName === 'style' || propName === 'class') {
						const index = propName === 'style' ? styleCount++ : classCount++;
						if (index >= 1 !== forRemainStyleOrClass)
							continue;
					}

					attrNames.add(prop.name);

					// camelize name
					const diagStart = tsCodeGen.getText().length;
					writeCode(
						propName,
						{
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + propName2.length,
						},
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.attr,
							beforeRename: camelize,
							doRename: keepHyphenateName,
						},
					);
					if (prop.value) {
						tsCodeGen.addText('={');
						writeAttrValue(prop.value);
						tsCodeGen.addText('}');
					}
					tsCodeGen.addText(' ');
					const diagEnd = tsCodeGen.getText().length;
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
						writeCode(
							propName2,
							{
								start: prop.loc.start.offset,
								end: prop.loc.start.offset + propName2.length,
							},
							SourceMaps.Mode.Offset,
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.attr,
								beforeRename: camelize,
								doRename: keepHyphenateName,
							},
						);
						if (prop.value) {
							tsCodeGen.addText('={');
							writeAttrValue(prop.value);
							tsCodeGen.addText('}');
						}
						tsCodeGen.addText(' ');
					}
				}
				else if (
					prop.type === CompilerDOM.NodeTypes.DIRECTIVE
					&& prop.name === 'bind'
					&& !prop.arg
					&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				) {
					if (forRemainStyleOrClass) {
						continue;
					}
					tsCodeGen.addText('{...');
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
					tsCodeGen.addText('} ');
				}
				else {
					if (forRemainStyleOrClass) {
						continue;
					}
					tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */ ");
				}
			}

			return { hasRemainStyleOrClass: styleCount >= 2 || classCount >= 2 };

			function writeAttrValue(attrNode: CompilerDOM.TextNode) {
				tsCodeGen.addText('"');
				let start = attrNode.loc.start.offset;
				let end = attrNode.loc.end.offset;
				if (end - start > attrNode.content.length) {
					start++;
					end--;
				}
				writeCode(
					toUnicode(attrNode.content),
					{ start, end },
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all
					},
				);
				tsCodeGen.addText('"');
			}
		}
	}
	function writeInlineCss(node: CompilerDOM.ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content === 'style'
				&& prop.exp.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY
			) {
				const endCrt = prop.arg.loc.source[prop.arg.loc.source.length - 1]; // " | '
				const start = prop.arg.loc.source.indexOf(endCrt) + 1;
				const end = prop.arg.loc.source.lastIndexOf(endCrt);
				const content = prop.arg.loc.source.substring(start, end);
				const sourceRange = {
					start: prop.arg.loc.start.offset + start,
					end: prop.arg.loc.start.offset + end,
				};

				const newStart = htmlToTemplate(sourceRange.start, sourceRange.end);
				if (newStart === undefined) continue;
				const offset = newStart - sourceRange.start;
				sourceRange.start += offset;
				sourceRange.end += offset;

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
	function writeImportSlots(node: CompilerDOM.ElementNode, parentEl: CompilerDOM.ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'slot'
			) {
				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					tsCodeGen.addText(`const `);
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
				if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.content !== '') {
					isStatic = prop.arg.isStatic;
					slotName = prop.arg.content;
				}
				const diagStart = tsCodeGen.getText().length;
				tsCodeGen.addText(`({ ...__VLS_getTemplateSlots(__VLS_wrapComponents[${tagResolves[parentEl.tag].name}]), ...__VLS_getScriptSlots(__VLS_rawComponents[${tagResolves[parentEl.tag].name}])})`);
				const argRange = prop.arg
					? {
						start: prop.arg.loc.start.offset,
						end: prop.arg.loc.end.offset,
					} : {
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + prop.loc.source.split('=')[0].length,
					};
				if (isStatic) {
					writePropertyAccess(
						slotName,
						argRange,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.slotName,
						},
					);
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
	function writeDirectives(node: CompilerDOM.ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name !== 'slot'
				&& prop.name !== 'on'
				&& prop.name !== 'model'
				&& prop.name !== 'bind'
			) {

				const diagStart = tsCodeGen.getText().length;
				tsCodeGen.addText(`__VLS_directiveFunction(`);
				writeCode(
					camelize('v-' + prop.name),
					{
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + 'v-'.length + prop.name.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.noDiagnostic,
						beforeRename: camelize,
						doRename: keepHyphenateName,
					},
				);
				tsCodeGen.addText(`)(`);
				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
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
				tsCodeGen.addText(`;\n`);
			}
		}
	}
	function writeElReferences(node: CompilerDOM.ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
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
						capabilities: capabilitiesSet.refAttr,
					},
				);
				tsCodeGen.addText(`);\n`);
			}
		}
	}
	function writeClassScopeds(node: CompilerDOM.ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				&& prop.name === 'class'
				&& prop.value
			) {
				let startOffset = prop.value.loc.start.offset + 1; // +1 is "
				let tempClassName = '';

				for (const char of (prop.value.content + ' ')) {
					if (char.trim() !== '') {
						tempClassName += char;
					}
					else if (tempClassName !== '') {
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
	function writeSlots(node: CompilerDOM.ElementNode) {
		if (node.tag !== 'slot') return;
		const varDefaultBind = `__VLS_${elementIndex++}`;
		const varBinds = `__VLS_${elementIndex++}`;
		const varSlot = `__VLS_${elementIndex++}`;
		const slotName = getSlotName();
		const slotNameExp = getSlotNameExp();
		let hasDefaultBind = false;

		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& !prop.arg
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
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
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
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
						beforeRename: camelize,
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
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				&& prop.name !== 'name' // slot name
			) {
				const propValue = prop.value !== undefined ? `"${toUnicode(prop.value.content)}"` : 'true';
				writeObjectProperty(
					prop.name,
					{
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + prop.name.length
					},
					{
						vueTag: 'template',
						beforeRename: camelize,
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
				if (prop2.name === 'name' && prop2.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop2.value) {
					if (prop2.value.content) {
						return prop2.value.content;
					}
				}
			}
			return 'default';
		}
		function getSlotNameExp() {
			for (const prop2 of node.props) {
				if (prop2.type === CompilerDOM.NodeTypes.DIRECTIVE && prop2.name === 'bind' && prop2.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop2.arg.content === 'name') {
					if (prop2.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
						return prop2.exp.content;
					}
					else {
						return `'default'`;
					}
				}
			}
		}
	}
	function writeObjectProperty2(mapCode: string, sourceRanges: SourceMaps.Range[], data: SourceMaps.TsMappingData) {
		const sourceRange = sourceRanges[0];
		const mode = writeObjectProperty(mapCode, sourceRange, data);

		for (let i = 1; i < sourceRanges.length; i++) {
			const sourceRange = sourceRanges[i];
			if (mode === 1) {
				addMapping(tsCodeGen, {
					sourceRange,
					mappedRange: {
						start: tsCodeGen.getText().length - mapCode.length,
						end: tsCodeGen.getText().length,
					},
					mode: SourceMaps.Mode.Offset,
					data,
				});
			}
			else if (mode === 2) {
				addMapping(tsCodeGen, {
					sourceRange,
					mappedRange: {
						start: tsCodeGen.getText().length - `'${mapCode}'`.length,
						end: tsCodeGen.getText().length - `'`.length,
					},
					mode: SourceMaps.Mode.Offset,
					additional: [
						{
							sourceRange,
							mappedRange: {
								start: tsCodeGen.getText().length - `'${mapCode}'`.length,
								end: tsCodeGen.getText().length,
							},
							mode: SourceMaps.Mode.Totally,
						}
					],
					data,
				});
			}
		}
	}
	function writeObjectProperty(mapCode: string, sourceRange: SourceMaps.Range, data: SourceMaps.TsMappingData) {
		if (validTsVar.test(mapCode) || (mapCode.startsWith('[') && mapCode.endsWith(']'))) {
			writeCode(mapCode, sourceRange, SourceMaps.Mode.Offset, data);
			return 1;
		}
		else {
			writeCodeWithQuotes(mapCode, sourceRange, data);
			return 2;
		}
	}
	function writePropertyAccess2(mapCode: string, sourceRanges: SourceMaps.Range[], data: SourceMaps.TsMappingData) {
		const sourceRange = sourceRanges[0];
		const mode = writePropertyAccess(mapCode, sourceRange, data);

		for (let i = 1; i < sourceRanges.length; i++) {
			const sourceRange = sourceRanges[i];
			if (mode === 1 || mode === 2) {
				addMapping(tsCodeGen, {
					sourceRange,
					mappedRange: {
						start: tsCodeGen.getText().length - mapCode.length,
						end: tsCodeGen.getText().length,
					},
					mode: sourceRange.end - sourceRange.start === mapCode.length ? SourceMaps.Mode.Offset : SourceMaps.Mode.Expand,
					data,
				});
			}
			else if (mode === 3) {
				addMapping(tsCodeGen, {
					sourceRange,
					mappedRange: {
						start: tsCodeGen.getText().length - `['${mapCode}']`.length,
						end: tsCodeGen.getText().length - `']`.length,
					},
					mode: SourceMaps.Mode.Offset,
					additional: [
						{
							sourceRange,
							mappedRange: {
								start: tsCodeGen.getText().length - `'${mapCode}']`.length,
								end: tsCodeGen.getText().length - `]`.length,
							},
							mode: SourceMaps.Mode.Totally,
						}
					],
					data,
				});
			}
		}
	}
	function writePropertyAccess(mapCode: string, sourceRange: SourceMaps.Range, data: SourceMaps.TsMappingData) {
		if (validTsVar.test(mapCode)) {
			tsCodeGen.addText(`.`);
			if (sourceRange.end - sourceRange.start === mapCode.length) {
				writeCode(mapCode, sourceRange, SourceMaps.Mode.Offset, data);
			}
			else {
				writeCode(mapCode, sourceRange, SourceMaps.Mode.Expand, data);
			}
			return 1;
		}
		else if (mapCode.startsWith('[') && mapCode.endsWith(']')) {
			writeCode(mapCode, sourceRange, SourceMaps.Mode.Offset, data);
			return 2;
		}
		else {
			tsCodeGen.addText(`[`);
			writeCodeWithQuotes(mapCode, sourceRange, data);
			tsCodeGen.addText(`]`);
			return 3;
		}
	}
	function writeCodeWithQuotes(mapCode: string, sourceRanges: SourceMaps.Range | SourceMaps.Range[], data: SourceMaps.TsMappingData) {
		const addText = `'${mapCode}'`;
		for (const sourceRange of 'length' in sourceRanges ? sourceRanges : [sourceRanges]) {
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
		}
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

		gen.addMapping2(newMapping);
	}
};

function toUnicode(str: string) {
	return str.split('').map(value => {
		var temp = value.charCodeAt(0).toString(16).padStart(4, '0');
		if (temp.length > 2) {
			return '\\u' + temp;
		}
		return value;
	}).join('');
}
function unHyphenatComponentName(newName: string) {
	return camelize('-' + newName);
}
function keepHyphenateName(oldName: string, newName: string) {
	if (oldName === hyphenate(oldName)) {
		return hyphenate(newName);
	}
	return newName
}
// https://github.com/vuejs/vue-next/blob/master/packages/compiler-dom/src/transforms/vModel.ts#L49-L51
// https://v3.vuejs.org/guide/forms.html#basic-usage
function getModelValuePropName(node: CompilerDOM.ElementNode, isVue2: boolean) {

	const tag = node.tag;
	const typeAttr = node.props.find(prop => prop.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop.name === 'type') as CompilerDOM.AttributeNode | undefined;
	const type = typeAttr?.value?.content;

	if (tag === 'input' && type === 'checkbox')
		return 'checked';

	if (tag === 'input' && type === 'radio')
		return '__VLS_radioBinding';

	if (
		tag === 'input' ||
		tag === 'textarea' ||
		tag === 'select' ||
		isVue2
	) return 'value';

	return 'modelValue';
}

// TODO: track https://github.com/vuejs/vue-next/issues/3498
export function getPatchForSlotNode(node: CompilerDOM.ElementNode) {
	const forDirective = node.props.find(
		(prop): prop is CompilerDOM.DirectiveNode =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'for'
	);
	if (forDirective) {
		let forNode: CompilerDOM.ForNode | undefined;
		CompilerCore.processFor(node, forDirective, transformContext, _forNode => {
			forNode = { ..._forNode };
			return undefined;
		});
		if (forNode) {
			forNode.children = [{
				...node,
				props: node.props.filter(prop => prop !== forDirective),
			}];
			return forNode;
		}
	}
}

import * as SourceMaps from '@volar/source-map';
import { CodeGen } from '@volar/code-gen';
import { camelize, hyphenate, isHTMLTag, isSVGTag } from '@vue/shared';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerCore from '@vue/compiler-core';
import { EmbeddedFileMappingData } from '../types';

const capabilitiesSet = {
	all: { basic: true, diagnostic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	noDiagnostic: { basic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	diagnosticOnly: { diagnostic: true, completion: true, },
	tagHover: { basic: true },
	event: { basic: true, diagnostic: true },
	tagReference: { references: true, definitions: true, rename: true, },
	attr: { basic: true, diagnostic: true, references: true, definitions: true, rename: true, },
	attrReference: { references: true, definitions: true, rename: true, },
	scopedClassName: { references: true, definitions: true, rename: true, completion: true, },
	slotName: { basic: true, diagnostic: true, references: true, definitions: true, completion: true, },
	slotNameExport: { basic: true, diagnostic: true, references: true, definitions: true, referencesCodeLens: true },
	refAttr: { references: true, definitions: true, rename: true, },
};
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
	sourceLang: string,
	templateAst: CompilerDOM.RootNode,
	isVue2: boolean,
	cssScopedClasses: string[] = [],
	htmlToTemplate: (htmlStart: number, htmlEnd: number) => { start: number, end: number } | undefined,
	isScriptSetup: boolean,
	searchTexts: {
		getEmitCompletion(tag: string): string,
		getPropsCompletion(tag: string): string,
	},
) {

	const tsCodeGen = new CodeGen<EmbeddedFileMappingData>();
	const tsFormatCodeGen = new CodeGen<EmbeddedFileMappingData>();
	const cssCodeGen = new CodeGen<EmbeddedFileMappingData>();
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
		rawComponent: string,
		slotsComponent: string,
		baseProps: string,
		emit: string,
		slots: string,
		events: Record<string, string>,
		offsets: number[],
	}> = {};

	let elementIndex = 0;

	for (const childNode of templateAst.children) {
		collectTags(childNode);
	}
	for (const tagName in tags) {

		const tag = tags[tagName];
		const tagRanges = tag.offsets.map(offset => ({ start: offset, end: offset + tagName.length }));
		const isNamespacedTag = tagName.indexOf('.') >= 0;

		const var_correctTagName = `__VLS_${elementIndex++}`;
		const var_rawComponent = `__VLS_${elementIndex++}`;
		const var_slotsComponent = `__VLS_${elementIndex++}`;
		const var_baseProps = `__VLS_${elementIndex++}`;
		const var_emit = `__VLS_${elementIndex++}`;
		const var_slots = `__VLS_${elementIndex++}`;
		const var_events: Record<string, string> = {};

		if (isNamespacedTag) {
			for (let i = 0; i < tagRanges.length; i++) {
				const tagRange = tagRanges[i];
				if (i === 0) {
					tsCodeGen.addText(`declare const ${var_rawComponent}: typeof `);
				}
				else {
					tsCodeGen.addText(`declare const __VLS_${elementIndex++}: typeof `);
				}
				writeCode(
					tagName,
					tagRange,
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
				);
				tsCodeGen.addText(`;\n`);
			}
		}
		else {
			tsCodeGen.addText(`declare const ${var_correctTagName}: __VLS_types.GetComponentName<typeof __VLS_rawComponents, '${tagName}'>;\n`);
			tsCodeGen.addText(`declare const ${var_rawComponent}: __VLS_types.GetProperty<typeof __VLS_rawComponents, typeof ${var_correctTagName}, any>;\n`);
		}
		tsCodeGen.addText(`declare const ${var_slotsComponent}: __VLS_types.SlotsComponent<typeof ${var_rawComponent}>;\n`);
		tsCodeGen.addText(`declare const ${var_baseProps}: __VLS_types.ExtractComponentProps<typeof ${var_rawComponent}>;\n`);
		tsCodeGen.addText(`declare const ${var_emit}: __VLS_types.ExtractEmit2<typeof ${var_rawComponent}>;\n`);

		if (isNamespacedTag) {
			tsCodeGen.addText(`declare const ${var_slots}:
				__VLS_types.TemplateSlots<typeof ${var_rawComponent}>
				& __VLS_types.DefaultSlots<typeof ${var_rawComponent}, typeof ${var_rawComponent}>;\n`);
		}
		else {
			tsCodeGen.addText(`declare const ${var_slots}:
				__VLS_types.TemplateSlots<typeof ${var_rawComponent}>
				& __VLS_types.DefaultSlots<typeof ${var_rawComponent}, typeof ${var_rawComponent}>;\n`);
		}

		for (const eventName in tag.events) {

			const var_on = `__VLS_${elementIndex++}`;
			const key_1 = eventName; // click-outside
			const key_3 = camelize(key_1); // clickOutside

			tsCodeGen.addText(`type ${var_on} = \n`);
			if (key_1 !== key_3) {
				tsCodeGen.addText(`__VLS_types.FirstFunction<\n`);
				tsCodeGen.addText(`__VLS_types.EmitEvent<typeof ${var_rawComponent}, '${key_1}'>,\n`);
				tsCodeGen.addText(`__VLS_types.EmitEvent<typeof ${var_rawComponent}, '${key_3}'>\n`);
				tsCodeGen.addText(`>;\n`);
			}
			else {
				tsCodeGen.addText(`__VLS_types.EmitEvent<typeof ${var_rawComponent}, '${key_1}'>;\n`);
			}

			var_events[eventName] = var_on;
		}

		const name1 = tagName; // hello-world
		const name2 = camelize(tagName); // helloWorld
		const name3 = name2[0].toUpperCase() + name2.slice(1); // HelloWorld
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

		if (!isNamespacedTag) {
			// split tagRanges to fix end tag definition original select range mapping to start tag
			for (const tagRange of tagRanges) {
				tsCodeGen.addText(`// @ts-ignore\n`);
				tsCodeGen.addText(`({ `);
				writeObjectProperty2(
					tagName,
					[tagRange],
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.tagHover,
					},
				);
				tsCodeGen.addText(`: {} as `);
				tsCodeGen.addText(`__VLS_types.PickNotAny<`.repeat(componentNames.size - 1));
				const names = [...componentNames];
				for (let i = 0; i < names.length; i++) {
					if (i > 0) {
						tsCodeGen.addText(', ');
					}
					tsCodeGen.addText(`typeof __VLS_rawComponents`);
					writePropertyAccess2(
						names[i],
						[tagRange],
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.tagReference,
							normalizeNewName: tagName === names[i] ? undefined : unHyphenatComponentName,
							applyNewName: keepHyphenateName,
						},
					);
					if (i > 0) {
						tsCodeGen.addText('>');
					}
				}
				tsCodeGen.addText(` });\n`);
			}
		}

		/* Completion */
		tsCodeGen.addText('/* Completion: Emits */\n');
		for (const name of componentNames) {
			tsCodeGen.addText('// @ts-ignore\n');
			tsCodeGen.addText(`${var_emit}('${searchTexts.getEmitCompletion(name)}');\n`);
		}
		tsCodeGen.addText('/* Completion: Props */\n');
		for (const name of componentNames) {
			tsCodeGen.addText(`${var_baseProps}.${searchTexts.getPropsCompletion(name)};\n`);
		}

		tagResolves[tagName] = {
			rawComponent: var_rawComponent,
			slotsComponent: var_slotsComponent,
			baseProps: var_baseProps,
			emit: var_emit,
			slots: var_slots,
			events: var_events,
			offsets: tag.offsets.map(offset => htmlToTemplate(offset, offset)?.start).filter(notEmpty),
		};
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
			SourceMaps.Mode.Expand,
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

					if (prop.modifiers.some(m => m === 'prop' || m === 'attr')) {
						propName = propName.substring(1);
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
			const { source, value, key, index } = node.parseResult;
			const leftExpressionRange = value ? { start: (value ?? key ?? index).loc.start.offset, end: (index ?? key ?? value).loc.end.offset } : undefined;
			const leftExpressionText = leftExpressionRange ? node.loc.source.substring(leftExpressionRange.start - node.loc.start.offset, leftExpressionRange.end - node.loc.start.offset) : undefined;

			tsCodeGen.addText(`for (const [`);
			if (leftExpressionRange && leftExpressionText) {
				writeCode(
					leftExpressionText,
					leftExpressionRange,
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					formatBrackets.square,
				);
			}
			tsCodeGen.addText(`] of __VLS_types.getVforSourceType(`);
			if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				writeCode(
					source.content,
					{
						start: source.loc.start.offset,
						end: source.loc.start.offset + source.content.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					formatBrackets.round,
				);
			}
			tsCodeGen.addText(`)) {\n`);

			for (const childNode of node.children) {
				visitNode(childNode, parentEl);
			}

			tsCodeGen.addText('}\n');
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
			const fullTagStart = tsCodeGen.getText().length;

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
			const { hasRemainStyleOrClass } = writeProps(node, false, 'props');
			tsCodeGen.addText(`/>`);

			// fix https://github.com/johnsoncodehk/volar/issues/705#issuecomment-974773353
			let startTagEnd: number;
			if (node.loc.source.endsWith('/>')) {
				startTagEnd = node.loc.end.offset;
			}
			else if (node.children.length) {
				startTagEnd = node.loc.start.offset + node.loc.source.substring(0, node.children[0].loc.start.offset - node.loc.start.offset).lastIndexOf('>') + 1;
			}
			else {
				startTagEnd = node.loc.start.offset + node.loc.source.substring(0, node.loc.source.lastIndexOf('</')).lastIndexOf('>') + 1;
			}
			addMapping(tsCodeGen, {
				sourceRange: {
					start: node.loc.start.offset,
					end: startTagEnd,
				},
				mappedRange: {
					start: fullTagStart,
					end: tsCodeGen.getText().length,
				},
				mode: SourceMaps.Mode.Totally,
				data: {
					vueTag: 'template',
					capabilities: capabilitiesSet.diagnosticOnly,
				},
			});
			tsCodeGen.addText(`\n`);

			if (hasRemainStyleOrClass) {
				tsCodeGen.addText(`<${tagText} `);
				writeProps(node, true, 'props');
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

			const varComponentInstance = `__VLS_${elementIndex++}`;
			let writedInstance = false;

			for (const prop of node.props) {
				if (
					prop.type === CompilerDOM.NodeTypes.DIRECTIVE
					&& prop.name === 'on'
					&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				) {

					const transformResult = CompilerDOM.transformOn(prop, node, transformContext);

					for (const prop_2 of transformResult.props) {

						tryWriteInstance();

						tsCodeGen.addText(`const __VLS_${elementIndex++}: {\n`);
						tsCodeGen.addText(`'${prop.arg.loc.source}': __VLS_types.FillingEventArg<\n`);
						{
							tsCodeGen.addText(`__VLS_types.FirstFunction<\n`);
							{
								tsCodeGen.addText(`__VLS_types.FirstFunction<\n`);
								tsCodeGen.addText(`${tagResolves[node.tag].events[prop.arg.loc.source]},\n`);
								{
									tsCodeGen.addText(`(typeof ${varComponentInstance} extends { $props: infer Props } ? Props & Omit<__VLS_types.GlobalAttrs, keyof Props> & Record<string, unknown> : typeof ${tagResolves[node.tag].rawComponent} & Record<string, unknown>)[`);
									const key_2 = camelize('on-' + prop.arg.loc.source); // onClickOutside
									writeCodeWithQuotes(
										key_2,
										[{ start: prop.arg.loc.start.offset, end: prop.arg.loc.end.offset }],
										{
											vueTag: 'template',
											capabilities: capabilitiesSet.attrReference,
											normalizeNewName(newName) {
												return camelize('on-' + newName);
											},
											applyNewName(oldName, newName) {
												const hName = hyphenate(newName);
												if (hyphenate(newName).startsWith('on-')) {
													return camelize(hName.slice('on-'.length));
												}
												return newName;
											},
										},
									);
									tsCodeGen.addText(`]\n`);
								}
								tsCodeGen.addText(`>,\n`);

								const camelizeName = camelize(prop.arg.loc.source);

								if (camelizeName === prop.arg.loc.source) {
									tsCodeGen.addText(`typeof ${varComponentInstance} extends { $emit: infer Emit } ? __VLS_types.EmitEvent2<Emit, '${prop.arg.loc.source}'> : unknown,\n`);
								}
								else {
									tsCodeGen.addText(`__VLS_types.FirstFunction<\n`);
									{
										tsCodeGen.addText(`typeof ${varComponentInstance} extends { $emit: infer Emit } ? __VLS_types.EmitEvent2<Emit, '${prop.arg.loc.source}'> : unknown,\n`);
										tsCodeGen.addText(`typeof ${varComponentInstance} extends { $emit: infer Emit } ? __VLS_types.EmitEvent2<Emit, '${camelizeName}'> : unknown,\n`);
									}
									tsCodeGen.addText(`>\n`);
								}
							}
							tsCodeGen.addText(`>\n`);
						}
						tsCodeGen.addText(`>\n`);
						tsCodeGen.addText(`} = {\n`);
						{
							writeObjectProperty(
								prop.arg.loc.source,
								{
									start: prop.arg.loc.start.offset,
									end: prop.arg.loc.end.offset,
								},
								SourceMaps.Mode.Offset,
								{
									vueTag: 'template',
									capabilities: capabilitiesSet.event,
								},
							);
							tsCodeGen.addText(`: `);
							appendExpressionNode(prop, prop_2.value);
						}
						tsCodeGen.addText(`};\n`);
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
						formatBrackets.round,
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
							formatBrackets.round,
						);
					}
					else {
						tsCodeGen.addText(node.content);
					}
				}
			}

			function tryWriteInstance() {

				if (writedInstance)
					return;

				tsCodeGen.addText(`const ${varComponentInstance} = new ${tagResolves[node.tag].rawComponent}({ `);
				writeProps(node, false, 'slots');
				tsCodeGen.addText(`});\n`);

				writedInstance = true;
			}
		}
	}
	function writeProps(node: CompilerDOM.ElementNode, forRemainStyleOrClass: boolean, mode: 'props' | 'slots') {

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

				if (prop.modifiers.some(m => m === 'prop' || m === 'attr')) {
					propName_1 = propName_1.substring(1);
				}

				const propName_2 = !isStatic ? propName_1 : hyphenate(propName_1) === propName_1 ? camelize(propName_1) : propName_1;

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
				writePropStart(isStatic);
				const diagStart = tsCodeGen.getText().length;
				if (!prop.arg) {
					writePropName(
						propName_1,
						isStatic,
						{
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + 'v-model'.length,
						},
						{
							vueTag: 'template',
							capabilities: getCaps(capabilitiesSet.attr),
						},
					);
				}
				else if (prop.exp?.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
					writePropName(
						propName_2,
						isStatic,
						{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.start.offset + propName_1.length, // patch style attr
						},
						{
							vueTag: 'template',
							capabilities: getCaps(capabilitiesSet.attr),
							normalizeNewName: camelize,
							applyNewName: keepHyphenateName,
						},
					);
				}
				else {
					writePropName(
						propName_2,
						isStatic,
						{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						},
						{
							vueTag: 'template',
							capabilities: getCaps(capabilitiesSet.attr),
							normalizeNewName: camelize,
							applyNewName: keepHyphenateName,
						},
					);
				}
				writePropValuePrefix(isStatic);
				if (prop.exp && !(prop.exp.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY)) { // style='z-index: 2' will compile to {'z-index':'2'}
					writeCode(
						prop.exp.loc.source,
						{
							start: prop.exp.loc.start.offset,
							end: prop.exp.loc.end.offset,
						},
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: getCaps(capabilitiesSet.all),
						},
						getFormatBrackets(formatBrackets.round),
					);
				}
				else {
					tsCodeGen.addText('undefined');
				}
				writePropValueSuffix(isStatic);
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
						capabilities: getCaps(capabilitiesSet.diagnosticOnly),
					},
				});
				writePropEnd(isStatic);
				// original name
				if (prop.arg && propName_1 !== propName_2) {
					writePropStart(isStatic);
					writePropName(
						propName_1,
						isStatic,
						{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						},
						{
							vueTag: 'template',
							capabilities: getCaps(capabilitiesSet.attr),
							normalizeNewName: camelize,
							applyNewName: keepHyphenateName,
						},
					);
					writePropValuePrefix(isStatic);
					tsCodeGen.addText(prop.exp?.loc.source ?? 'undefined');
					writePropValueSuffix(isStatic);
					writePropEnd(isStatic);
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
				writePropStart(true);
				const diagStart = tsCodeGen.getText().length;
				writePropName(
					propName,
					true,
					{
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + propName2.length,
					},
					{
						vueTag: 'template',
						capabilities: getCaps(capabilitiesSet.attr),
						normalizeNewName: camelize,
						applyNewName: keepHyphenateName,
					},
				);
				writePropValuePrefix(true);
				if (prop.value) {
					writeAttrValue(prop.value);
				}
				else {
					tsCodeGen.addText('true');
				}
				writePropValueSuffix(true);
				writePropEnd(true);
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
						capabilities: getCaps(capabilitiesSet.diagnosticOnly),
					},
				});
				// original name
				if (propName2 !== propName) {
					writePropStart(true);
					writePropName(
						propName2,
						true,
						{
							start: prop.loc.start.offset,
							end: prop.loc.start.offset + propName2.length,
						},
						{
							vueTag: 'template',
							capabilities: getCaps(capabilitiesSet.attr),
							normalizeNewName: camelize,
							applyNewName: keepHyphenateName,
						},
					);
					writePropValuePrefix(true);
					if (prop.value) {
						writeAttrValue(prop.value);
					}
					else {
						tsCodeGen.addText('true');
					}
					writePropValueSuffix(true);
					writePropEnd(true);
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
				if (mode === 'props')
					tsCodeGen.addText('{...');
				else
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
						capabilities: getCaps(capabilitiesSet.all),
					},
					getFormatBrackets(formatBrackets.round),
				);
				if (mode === 'props')
					tsCodeGen.addText('} ');
				else
					tsCodeGen.addText('), ');
			}
			else {
				if (forRemainStyleOrClass) {
					continue;
				}
				tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */ ");
			}
		}

		return { hasRemainStyleOrClass: styleCount >= 2 || classCount >= 2 };

		function writePropName(name: string, isStatic: boolean, sourceRange: SourceMaps.Range, data: EmbeddedFileMappingData) {
			if (mode === 'props' && isStatic) {
				writeCode(
					name,
					sourceRange,
					SourceMaps.Mode.Offset,
					data,
				);
			}
			else {
				writeObjectProperty(
					name,
					sourceRange,
					SourceMaps.Mode.Offset,
					data,
				);
			}
		}
		function writePropValuePrefix(isStatic: boolean) {
			if (mode === 'props' && isStatic) {
				tsCodeGen.addText('={');
			}
			else {
				tsCodeGen.addText(': (');
			}
		}
		function writePropValueSuffix(isStatic: boolean) {
			if (mode === 'props' && isStatic) {
				tsCodeGen.addText('}');
			}
			else {
				tsCodeGen.addText(')');
			}
		}
		function writePropStart(isStatic: boolean) {
			if (mode === 'props' && !isStatic) {
				tsCodeGen.addText('{...{');
			}
		}
		function writePropEnd(isStatic: boolean) {
			if (mode === 'props' && isStatic) {
				tsCodeGen.addText(' ');
			}
			else if (mode === 'props' && !isStatic) {
				tsCodeGen.addText('}} ');
			}
			else {
				tsCodeGen.addText(', ');
			}
		}
		function getCaps(caps: EmbeddedFileMappingData['capabilities']): EmbeddedFileMappingData['capabilities'] {
			if (mode === 'props') {
				return caps;
			}
			else {
				return {
					references: caps.references,
					rename: caps.rename,
				};
			}
		}
		function getFormatBrackets(b: [string, string]) {
			if (mode === 'props') {
				return b;
			}
			else {
				return undefined;
			}
		}
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
					capabilities: getCaps(capabilitiesSet.all)
				},
			);
			tsCodeGen.addText('"');
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

				const newStart = htmlToTemplate(sourceRange.start, sourceRange.end)?.start;
				if (newStart === undefined) continue;
				const offset = newStart - sourceRange.start;
				sourceRange.start += offset;
				sourceRange.end += offset;

				cssCodeGen.addText(`${node.tag} { `);
				cssCodeGen.addCode(
					content,
					sourceRange,
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
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

				const varComponentInstance = `__VLS_${elementIndex++}`;
				const varSlots = `__VLS_${elementIndex++}`;

				tsCodeGen.addText(`const ${varComponentInstance} = new ${tagResolves[parentEl.tag].slotsComponent}({ `);
				writeProps(parentEl, false, 'slots');
				tsCodeGen.addText(`});\n`);

				tsCodeGen.addText(`declare const ${varSlots}: typeof ${tagResolves[parentEl.tag].slots} & __VLS_types.ScriptSlots<typeof ${varComponentInstance}>;\n`);

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
				tsCodeGen.addText(varSlots);
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
						false,
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
				tsCodeGen.addText(`__VLS_types.directiveFunction(`);
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
						normalizeNewName: camelize,
						applyNewName: keepHyphenateName,
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

				let startOffset = prop.value.loc.start.offset;
				let tempClassName = '';
				let openedBlock = false;

				for (const char of (prop.value.loc.source + ' ')) {
					if (char.trim() === '' || char === '"' || char === "'") {
						if (tempClassName !== '') {
							addClass(tempClassName, startOffset);
							startOffset += tempClassName.length;
							tempClassName = '';
						}
						startOffset += char.length;
					}
					else {
						tempClassName += char;
					}
				}

				if (openedBlock) {
					tsCodeGen.addText(`}\n`);
				}

				function addClass(className: string, offset: number) {
					if (!openedBlock) {
						tsCodeGen.addText(`if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {\n`);
						openedBlock = true;
					}
					tsCodeGen.addText(`__VLS_styleScopedClasses[`);
					writeCodeWithQuotes(
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
					tsCodeGen.addText(`];\n`);
				}
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content === 'class'
			) {
				tsCodeGen.addText(`__VLS_styleScopedClasses = (`);
				writeCode(
					prop.exp.content,
					{
						start: prop.exp.loc.start.offset,
						end: prop.exp.loc.end.offset,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.scopedClassName,
					},
				);
				tsCodeGen.addText(`);\n`);
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
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						normalizeNewName: camelize,
						applyNewName: keepHyphenateName,
						capabilities: capabilitiesSet.attrReference,
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
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						normalizeNewName: camelize,
						applyNewName: keepHyphenateName,
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
	function writeObjectProperty2(mapCode: string, sourceRanges: SourceMaps.Range[], data: EmbeddedFileMappingData) {
		const sourceRange = sourceRanges[0];
		const mode = writeObjectProperty(mapCode, sourceRange, SourceMaps.Mode.Offset, data);

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
	function writeObjectProperty(mapCode: string, sourceRange: SourceMaps.Range, mapMode: SourceMaps.Mode, data: EmbeddedFileMappingData) {
		if (validTsVar.test(mapCode) || (mapCode.startsWith('[') && mapCode.endsWith(']'))) {
			writeCode(mapCode, sourceRange, mapMode, data);
			return 1;
		}
		else {
			writeCodeWithQuotes(mapCode, sourceRange, data);
			return 2;
		}
	}
	function writePropertyAccess2(mapCode: string, sourceRanges: SourceMaps.Range[], data: EmbeddedFileMappingData) {
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
	function writePropertyAccess(mapCode: string, sourceRange: SourceMaps.Range, data: EmbeddedFileMappingData, checkValid = true) {
		if (checkValid && validTsVar.test(mapCode)) {
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
	function writeCodeWithQuotes(mapCode: string, sourceRanges: SourceMaps.Range | SourceMaps.Range[], data: EmbeddedFileMappingData) {
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
	function writeCode(mapCode: string, sourceRange: SourceMaps.Range, mode: SourceMaps.Mode, data: EmbeddedFileMappingData, formatWrapper?: [string, string]) {
		if (formatWrapper) {
			tsFormatCodeGen.addText(formatWrapper[0]);
			const targetRange = tsFormatCodeGen.addText(mapCode);
			addMapping(tsFormatCodeGen, {
				mappedRange: targetRange,
				sourceRange,
				mode,
				data: {
					vueTag: 'template',
					capabilities: {},
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
	function addMapping(gen: typeof tsCodeGen, mapping: SourceMaps.Mapping<EmbeddedFileMappingData>) {
		const newMapping = { ...mapping };

		const templateStart = htmlToTemplate(mapping.sourceRange.start, mapping.sourceRange.end)?.start;
		if (templateStart === undefined) return; // not found
		const offset = templateStart - mapping.sourceRange.start;
		newMapping.sourceRange = {
			start: mapping.sourceRange.start + offset,
			end: mapping.sourceRange.end + offset,
		};

		if (mapping.additional) {
			newMapping.additional = [];
			for (const other of mapping.additional) {
				let otherTemplateStart = htmlToTemplate(other.sourceRange.start, other.sourceRange.end)?.start;
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

function notEmpty<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

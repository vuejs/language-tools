import * as SourceMaps from '@volar/source-map';
import { CodeGen } from '@volar/code-gen';
import { camelize, hyphenate, capitalize, isHTMLTag, isSVGTag } from '@vue/shared';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerCore from '@vue/compiler-core';
import { EmbeddedFileMappingData } from '../types';
import { colletVars, walkInterpolationFragment } from '../transform';

const capabilitiesSet = {
	all: { basic: true, diagnostic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	noDiagnostic: { basic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	diagnosticOnly: { diagnostic: true, completion: true },
	tagHover: { basic: true },
	event: { basic: true, diagnostic: true },
	tagReference: { references: true, definitions: true, rename: { in: false, out: true } },
	attr: { basic: true, diagnostic: true, references: true, definitions: true, rename: true },
	attrReference: { references: true, definitions: true, rename: true },
	scopedClassName: { references: true, definitions: true, rename: true, completion: true },
	slotName: { basic: true, diagnostic: true, references: true, definitions: true, completion: true },
	slotNameExport: { basic: true, diagnostic: true, references: true, definitions: true, /* referencesCodeLens: true */ },
	refAttr: { references: true, definitions: true, rename: true },
};
const formatBrackets = {
	empty: ['', ''] as [string, string],
	round: ['(', ')'] as [string, string],
	// fix https://github.com/johnsoncodehk/volar/issues/1210
	curly: ['({ __VLS_foo:', '})'] as [string, string],
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

function _isHTMLTag(tag: string) {
	return isHTMLTag(tag)
		// fix https://github.com/johnsoncodehk/volar/issues/1340
		|| tag === 'hgroup'
		|| tag === 'slot'
		|| tag === 'component';
}

export function isIntrinsicElement(runtimeMode: 'runtime-dom' | 'runtime-uni-app' = 'runtime-dom', tag: string) {
	return runtimeMode === 'runtime-dom' ? (_isHTMLTag(tag) || isSVGTag(tag)) : ['block', 'component', 'template', 'slot'].includes(tag);
}

export function generate(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	compilerOptions: {
		target: number,
		experimentalRuntimeMode: 'runtime-dom' | 'runtime-uni-app' | undefined,
		experimentalAllowTypeNarrowingInInlineHandlers: boolean,
		experimentalSuppressInvalidJsxElementTypeErrors: boolean,
	},
	sourceLang: string,
	templateAst: CompilerDOM.RootNode,
	hasScriptSetup: boolean,
	cssScopedClasses: string[] = [],
	htmlToTemplate: (htmlRange: { start: number, end: number; }) => { start: number, end: number; } | undefined,
	searchTexts: {
		getEmitCompletion(tag: string): string,
		getPropsCompletion(tag: string): string,
	},
) {

	const tsCodeGen = new CodeGen<EmbeddedFileMappingData>();
	const tsFormatCodeGen = new CodeGen<EmbeddedFileMappingData>();
	const cssCodeGen = new CodeGen<EmbeddedFileMappingData>();
	const slots = new Map<string, {
		varName: string,
		loc: SourceMaps.Range,
	}>();
	const slotExps = new Map<string, {
		varName: string,
		loc: SourceMaps.Range,
	}>();
	const cssScopedClassesSet = new Set(cssScopedClasses);
	const tagOffsetsMap: Record<string, number[]> = {};
	const tagResolves: Record<string, {
		component: string,
		emit: string,
		offsets: number[],
	} | undefined> = {};
	const localVars: Record<string, number> = {};
	const identifiers = new Set<string>();
	const scopedClasses: { className: string, offset: number; }[] = [];
	const blockConditions: string[] = [];

	tsFormatCodeGen.addText('export { };\n');

	let elementIndex = 0;

	walkElementNodes(templateAst, node => {

		if (!tagOffsetsMap[node.tag]) {
			tagOffsetsMap[node.tag] = [];
		}

		const offsets = tagOffsetsMap[node.tag];

		offsets.push(node.loc.start.offset + node.loc.source.indexOf(node.tag)); // start tag
		if (!node.isSelfClosing && sourceLang === 'html') {
			offsets.push(node.loc.start.offset + node.loc.source.lastIndexOf(node.tag)); // end tag
		}
	});

	for (const tagName in tagOffsetsMap) {

		if (isIntrinsicElement(compilerOptions.experimentalRuntimeMode, tagName))
			continue;

		const tagOffsets = tagOffsetsMap[tagName];
		const tagRanges = tagOffsets.map(offset => ({ start: offset, end: offset + tagName.length }));
		const isNamespacedTag = tagName.indexOf('.') >= 0;

		const var_componentVar = capitalize(camelize(tagName));
		const var_emit = `__VLS_${elementIndex++}`;

		if (isNamespacedTag) {
			for (let i = 0; i < tagRanges.length; i++) {
				const tagRange = tagRanges[i];
				if (i === 0) {
					tsCodeGen.addText(`declare const ${var_componentVar}: typeof __VLS_ctx.`);
				}
				else {
					tsCodeGen.addText(`declare const __VLS_${elementIndex++}: typeof __VLS_ctx.`);
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
			const names = new Set([
				tagName,
				camelize(tagName),
				capitalize(camelize(tagName)),
			]);

			for (let i = 0; i < tagRanges.length; i++) {

				const tagRange = tagRanges[i];

				tsCodeGen.addText(`declare const ${var_componentVar + (i === 0 ? '' : '_')}: `);

				if (compilerOptions.experimentalSuppressInvalidJsxElementTypeErrors)
					tsCodeGen.addText(`__VLS_types.ConvertInvalidJsxElement<`);

				for (const name of names) {
					tsCodeGen.addText(`\n'${name}' extends keyof typeof __VLS_components ? typeof __VLS_components`);
					writePropertyAccess2(
						name,
						[tagRange],
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.tagReference,
							normalizeNewName: tagName === name ? undefined : unHyphenatComponentName,
							applyNewName: keepHyphenateName,
						},
					);
					tsCodeGen.addText(` : `);
				}
				tsCodeGen.addText(`unknown`);

				if (compilerOptions.experimentalSuppressInvalidJsxElementTypeErrors)
					tsCodeGen.addText(`>`);

				tsCodeGen.addText(`;\n`);
			}
		}
		tsCodeGen.addText(`declare const ${var_emit}: __VLS_types.ExtractEmit2<typeof ${var_componentVar}>;\n`);

		const name1 = tagName; // hello-world
		const name2 = isIntrinsicElement(compilerOptions.experimentalRuntimeMode, tagName) ? tagName : camelize(tagName); // helloWorld
		const name3 = isIntrinsicElement(compilerOptions.experimentalRuntimeMode, tagName) ? tagName : capitalize(name2); // HelloWorld
		const componentNames = new Set([name1, name2, name3]);

		/* Completion */
		tsCodeGen.addText('/* Completion: Emits */\n');
		for (const name of componentNames) {
			tsCodeGen.addText('// @ts-ignore\n');
			tsCodeGen.addText(`${var_emit}('${searchTexts.getEmitCompletion(name)}');\n`);
		}
		tsCodeGen.addText('/* Completion: Props */\n');
		for (const name of componentNames) {
			tsCodeGen.addText('// @ts-ignore\n');
			tsCodeGen.addText(`(<${isIntrinsicElement(compilerOptions.experimentalRuntimeMode, tagName) ? tagName : var_componentVar} ${searchTexts.getPropsCompletion(name)}/>);\n`);
		}

		tagResolves[tagName] = {
			component: var_componentVar,
			emit: var_emit,
			offsets: tagOffsets.map(offset => htmlToTemplate({ start: offset, end: offset })?.start).filter(notEmpty),
		};
	}

	for (const childNode of templateAst.children) {
		tsCodeGen.addText(`{\n`);
		visitNode(childNode, undefined);
		tsCodeGen.addText(`}\n`);
	}

	tsCodeGen.addText(`if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {\n`);
	for (const { className, offset } of scopedClasses) {
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
	tsCodeGen.addText('}\n');

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
				capabilities: {
					...capabilitiesSet.slotNameExport,
					referencesCodeLens: hasScriptSetup,
				},
			},
		);
		tsCodeGen.addText(`: typeof ${slot.varName},\n`);
	}
	tsCodeGen.addText(`};\n`);

	return {
		codeGen: tsCodeGen,
		formatCodeGen: tsFormatCodeGen,
		cssCodeGen: cssCodeGen,
		tagNames: tagOffsetsMap,
		identifiers,
	};

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

			tsCodeGen.addText(`(`);
			writeInterpolation(
				context,
				start,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.all,
				},
				'',
				'',
			);
			writeFormatCode(
				context,
				start,
				formatBrackets.curly,
			);
			tsCodeGen.addText(`);\n`);
		}
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			// v-if / v-else-if / v-else

			let originalBlockConditionsLength = blockConditions.length;

			for (let i = 0; i < node.branches.length; i++) {

				const branch = node.branches[i];

				if (i === 0)
					tsCodeGen.addText('if');
				else if (branch.condition)
					tsCodeGen.addText('else if');
				else
					tsCodeGen.addText('else');

				let addedBlockCondition = false;

				if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					tsCodeGen.addText(` `);
					writeInterpolation(
						branch.condition.content,
						branch.condition.loc.start.offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						'(',
						')',
					);
					writeFormatCode(
						branch.condition.content,
						branch.condition.loc.start.offset,
						formatBrackets.round,
					);

					if (compilerOptions.experimentalAllowTypeNarrowingInInlineHandlers) {
						blockConditions.push(branch.condition.content);
						addedBlockCondition = true;
					}
				}
				tsCodeGen.addText(` {\n`);
				for (const childNode of branch.children) {
					visitNode(childNode, parentEl);
				}
				tsCodeGen.addText('}\n');

				if (addedBlockCondition) {
					blockConditions[blockConditions.length - 1] = `!(${blockConditions[blockConditions.length - 1]})`;
				}
			}

			blockConditions.length = originalBlockConditionsLength;
		}
		else if (node.type === CompilerDOM.NodeTypes.FOR) {
			// v-for
			const { source, value, key, index } = node.parseResult;
			const leftExpressionRange = value ? { start: (value ?? key ?? index).loc.start.offset, end: (index ?? key ?? value).loc.end.offset } : undefined;
			const leftExpressionText = leftExpressionRange ? node.loc.source.substring(leftExpressionRange.start - node.loc.start.offset, leftExpressionRange.end - node.loc.start.offset) : undefined;
			const forBlockVars: string[] = [];

			tsCodeGen.addText(`for (const [`);
			if (leftExpressionRange && leftExpressionText) {

				const collentAst = ts.createSourceFile('/foo.ts', `const [${leftExpressionText}]`, ts.ScriptTarget.ESNext);
				colletVars(ts, collentAst, forBlockVars);

				for (const varName of forBlockVars)
					localVars[varName] = (localVars[varName] ?? 0) + 1;

				writeCode(
					leftExpressionText,
					leftExpressionRange,
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
				);
				writeFormatCode(
					leftExpressionText,
					leftExpressionRange.start,
					formatBrackets.square,
				);
			}
			tsCodeGen.addText(`] of __VLS_types.getVforSourceType`);
			if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				writeInterpolation(
					source.content,
					source.loc.start.offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					'(',
					')',
				);
				writeFormatCode(
					source.content,
					source.loc.start.offset,
					formatBrackets.round,
				);
			}
			tsCodeGen.addText(`) {\n`);

			for (const childNode of node.children) {
				visitNode(childNode, parentEl);
			}

			tsCodeGen.addText('}\n');

			for (const varName of forBlockVars)
				localVars[varName]--;
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

			const _isIntrinsicElement = isIntrinsicElement(compilerOptions.experimentalRuntimeMode, node.tag);
			const tagText = tagResolves[node.tag]?.component ?? node.tag;
			const fullTagStart = tsCodeGen.getText().length;
			const tagCapabilities = {
				...capabilitiesSet.diagnosticOnly,
				...capabilitiesSet.tagHover,
				...(_isIntrinsicElement ? {
					...capabilitiesSet.tagReference,
				} : {})
			};
			const endTagOffset = !node.isSelfClosing && sourceLang === 'html' ? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) : undefined;

			tsCodeGen.addText(`<`);
			writeCode(
				tagText,
				{
					start: node.loc.start.offset + node.loc.source.indexOf(node.tag),
					end: node.loc.start.offset + node.loc.source.indexOf(node.tag) + node.tag.length,
				},
				SourceMaps.Mode.Offset,
				{
					vueTag: 'template',
					capabilities: tagCapabilities,
				},
			);
			tsCodeGen.addText(` `);
			const { hasRemainStyleOrClass } = writeProps(node, false, 'props');

			if (endTagOffset === undefined) {
				tsCodeGen.addText(`/>`);
			}
			else {
				tsCodeGen.addText(`></`);
				writeCode(
					tagText,
					{
						start: endTagOffset,
						end: endTagOffset + node.tag.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: tagCapabilities,
					},
				);
				tsCodeGen.addText(`>`);
			}

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

			let slotBlockVars: string[] | undefined;

			writeInlineCss(node);
			if (parentEl) {

				slotBlockVars = [];
				writeImportSlots(node, parentEl, slotBlockVars);

				for (const varName of slotBlockVars)
					localVars[varName] = (localVars[varName] ?? 0) + 1;
			}
			writeDirectives(node);
			writeElReferences(node); // <el ref="foo" />
			if (cssScopedClasses.length) writeClassScopeds(node);
			writeEvents(node);
			writeSlots(node);

			for (const childNode of node.children) {
				visitNode(childNode, parentEl);
			}

			if (slotBlockVars) {
				for (const varName of slotBlockVars)
					localVars[varName]--;
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

						const tag = tagResolves[node.tag];
						const varInstanceProps = `__VLS_${elementIndex++}`;

						if (tag) {
							tsCodeGen.addText(`type ${varInstanceProps} = typeof ${varComponentInstance} extends { $props: infer Props } ? Props & Record<string, unknown> : typeof ${tag.component} & Record<string, unknown>;\n`);
						}

						tsCodeGen.addText(`const __VLS_${elementIndex++}: {\n`);
						tsCodeGen.addText(`'${prop.arg.loc.source}': __VLS_types.FillingEventArg<\n`);
						{

							const key_2 = camelize('on-' + prop.arg.loc.source); // onClickOutside
							const key_3 = 'on' + capitalize(prop.arg.loc.source); // onClick-outside

							if (tag) {

								tsCodeGen.addText(`__VLS_types.FirstFunction<\n`);

								{
									tsCodeGen.addText(`__VLS_types.EmitEvent<typeof ${tag.component}, '${prop.arg.loc.source}'>,\n`);
								}

								{
									tsCodeGen.addText(`${varInstanceProps}[`);
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
									tsCodeGen.addText(`],\n`);
								}

								{
									if (key_3 !== key_2) {
										tsCodeGen.addText(`${varInstanceProps}[`);
										writeCodeWithQuotes(
											key_3,
											[{ start: prop.arg.loc.start.offset, end: prop.arg.loc.end.offset }],
											{
												vueTag: 'template',
												capabilities: capabilitiesSet.attrReference,
												normalizeNewName(newName) {
													return 'on' + capitalize(newName);
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
										tsCodeGen.addText(`],\n`);
									}
								}

								{
									tsCodeGen.addText(`typeof ${varComponentInstance} extends { $emit: infer Emit } ? __VLS_types.EmitEvent2<Emit, '${prop.arg.loc.source}'> : unknown,\n`);
								}
							}

							{
								tsCodeGen.addText(`__VLS_types.GlobalAttrs[`);
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
								tsCodeGen.addText(`],\n`);
							}

							if (tag) {
								tsCodeGen.addText(`>\n`);
							}
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
					writeInterpolation(
						prop.exp.content,
						prop.exp.loc.start.offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						'$event => {(',
						')}',
					);
					writeFormatCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						formatBrackets.round,
					);
					tsCodeGen.addText(`;\n`);
				}

				function appendExpressionNode(prop: CompilerDOM.DirectiveNode, jsChildNode: CompilerDOM.JSChildNode) {
					if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
						if (jsChildNode.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {

							writeInterpolation(
								prop.exp.content,
								prop.exp.loc.start.offset,
								{
									vueTag: 'template',
									capabilities: capabilitiesSet.all,
								},
								'(',
								')',
							);
							writeFormatCode(
								prop.exp.content,
								prop.exp.loc.start.offset,
								formatBrackets.round,
							);
						}
						else if (jsChildNode.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {

							const _exp = prop.exp;
							const expIndex = jsChildNode.children.findIndex(child => typeof child === 'object' && child.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && child.content === _exp.content);
							const expNode = jsChildNode.children[expIndex] as CompilerDOM.SimpleExpressionNode;
							let prefix = jsChildNode.children.filter((child, i) => typeof child === 'string' && i < expIndex).map(child => child as string).join('');
							let suffix = jsChildNode.children.filter((child, i) => typeof child === 'string' && i > expIndex).map(child => child as string).join('');

							if (prefix && blockConditions.length) {
								prefix = prefix.replace('(', '{ ');
								suffix = suffix.replace(')', '} ');
								prefix += '\n';
								for (const blockCondition of blockConditions) {
									prefix += `if (!(${blockCondition})) return;\n`;
								}
							}

							writeInterpolation(
								expNode.content,
								expNode.loc.start.offset,
								{
									vueTag: 'template',
									capabilities: capabilitiesSet.all,
								},
								prefix,
								suffix,
							);
							writeFormatCode(
								expNode.content,
								expNode.loc.start.offset,
								formatBrackets.round,
							);
						}
					}
					else {
						tsCodeGen.addText(`undefined`);
					}
				}
			}

			function tryWriteInstance() {

				if (writedInstance)
					return;

				const tag = tagResolves[node.tag];

				if (tag) {
					tsCodeGen.addText(`const ${varComponentInstance} = new ${tag.component}({ `);
					writeProps(node, false, 'slots');
					tsCodeGen.addText(`});\n`);
				}

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
						: getModelValuePropName(node, compilerOptions.target);

				if (prop.modifiers.some(m => m === 'prop' || m === 'attr')) {
					propName_1 = propName_1.substring(1);
				}

				const propName_2 = !isStatic ? propName_1
					: hyphenate(propName_1) === propName_1 && !propName_1.startsWith('data-') && !propName_1.startsWith('aria-') ? camelize(propName_1)
						: propName_1;

				if (forRemainStyleOrClass && propName_2 !== 'style' && propName_2 !== 'class')
					continue;

				if (propName_2 === 'style' || propName_2 === 'class') {
					const index = propName_2 === 'style' ? styleCount++ : classCount++;
					if (index >= 1 !== forRemainStyleOrClass)
						continue;
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
					writeInterpolation(
						prop.exp.loc.source,
						prop.exp.loc.start.offset,
						{
							vueTag: 'template',
							capabilities: getCaps(capabilitiesSet.all),
						},
						'(',
						')',
					);
					const fb = getFormatBrackets(formatBrackets.round);
					if (fb) {
						writeFormatCode(
							prop.exp.loc.source,
							prop.exp.loc.start.offset,
							fb,
						);
					}
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
					if (prop.exp) {
						writeInterpolation(
							prop.exp.loc.source,
							undefined,
							undefined,
							'(',
							')',
						);
					}
					else {
						tsCodeGen.addText('undefined');
					}
					writePropValueSuffix(isStatic);
					writePropEnd(isStatic);
				}
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			) {

				const propName = hyphenate(prop.name) === prop.name && !prop.name.startsWith('data-') && !prop.name.startsWith('aria-') ? camelize(prop.name) : prop.name;
				const propName2 = prop.name;

				if (forRemainStyleOrClass && propName !== 'style' && propName !== 'class')
					continue;

				if (propName === 'style' || propName === 'class') {
					const index = propName === 'style' ? styleCount++ : classCount++;
					if (index >= 1 !== forRemainStyleOrClass)
						continue;
				}

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
					tsCodeGen.addText('...');
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					{
						vueTag: 'template',
						capabilities: getCaps(capabilitiesSet.all),
					},
					'(',
					')',
				);
				const fb = getFormatBrackets(formatBrackets.round);
				if (fb) {
					writeFormatCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						fb,
					);
				}
				if (mode === 'props')
					tsCodeGen.addText('} ');
				else
					tsCodeGen.addText(', ');
			}
			else {
				if (forRemainStyleOrClass) {
					continue;
				}
				// comment this line to avoid affecting comments in prop expressions
				// tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */ ");
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

				const newStart = htmlToTemplate({ start: sourceRange.start, end: sourceRange.end })?.start;
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
	function writeImportSlots(node: CompilerDOM.ElementNode, parentEl: CompilerDOM.ElementNode, slotBlockVars: string[]) {

		const tag = tagResolves[parentEl.tag];

		if (!tag)
			return;


		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'slot'
			) {

				const varComponentInstance = `__VLS_${elementIndex++}`;
				const varSlots = `__VLS_${elementIndex++}`;

				tsCodeGen.addText(`const ${varComponentInstance} = new ${tag.component}({ `);
				writeProps(parentEl, false, 'slots');
				tsCodeGen.addText(`});\n`);
				tsCodeGen.addText(`declare const ${varSlots}: __VLS_types.ExtractComponentSlots<typeof ${varComponentInstance}>;\n`);

				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					tsCodeGen.addText(`const `);

					const collentAst = ts.createSourceFile('/foo.ts', `const ${prop.exp.content}`, ts.ScriptTarget.ESNext);
					colletVars(ts, collentAst, slotBlockVars);

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
					);
					writeFormatCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
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
							capabilities: {
								...capabilitiesSet.slotName,
								completion: !!prop.arg,
							},
						},
						false,
					);
				}
				else {
					tsCodeGen.addText(`[`);
					writeInterpolation(
						slotName,
						argRange.start + 1,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						'',
						'',
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

				if (isStatic && !prop.arg) {

					let offset = prop.loc.start.offset;

					if (prop.loc.source.startsWith('#'))
						offset += '#'.length;
					else if (prop.loc.source.startsWith('v-slot:'))
						offset += 'v-slot:'.length;

					tsCodeGen.addText(varSlots);
					tsCodeGen.addText(`['`);
					writeCode(
						'',
						{ start: offset, end: offset },
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: {
								completion: true,
							},
						},
					);
					tsCodeGen.addText(`'];\n`);
				}
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
				tsCodeGen.addText(`__VLS_types.directiveFunction(__VLS_ctx.`);
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
				identifiers.add(camelize('v-' + prop.name));
				tsCodeGen.addText(`)(`);
				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					writeInterpolation(
						prop.exp.content,
						prop.exp.loc.start.offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						'(',
						')',
					);
					writeFormatCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
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
				writeInterpolation(
					prop.value.content,
					prop.value.loc.start.offset + 1,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.refAttr,
					},
					'(',
					')',
				);
				tsCodeGen.addText(`;\n`);
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

				for (const char of (prop.value.loc.source + ' ')) {
					if (char.trim() === '' || char === '"' || char === "'") {
						if (tempClassName !== '') {
							scopedClasses.push({ className: tempClassName, offset: startOffset });
							startOffset += tempClassName.length;
							tempClassName = '';
						}
						startOffset += char.length;
					}
					else {
						tempClassName += char;
					}
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

		if (node.tag !== 'slot')
			return;

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
				tsCodeGen.addText(`const ${varDefaultBind} = `);
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.attrReference,
					},
					'(',
					')',
				);
				tsCodeGen.addText(`;\n`);
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
				tsCodeGen.addText(`: `);
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.attrReference,
					},
					'(',
					')',
				);
				tsCodeGen.addText(`,\n`);
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
		if (validTsVar.test(mapCode)) {
			writeCode(mapCode, sourceRange, mapMode, data);
			return 1;
		}
		else if (mapCode.startsWith('[') && mapCode.endsWith(']')) {
			writeInterpolation(
				mapCode,
				sourceRange.start,
				data,
				'',
				'',
			);
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
	function writeInterpolation(
		mapCode: string,
		sourceOffset: number | undefined,
		data: EmbeddedFileMappingData | undefined,
		prefix: string,
		suffix: string,
	) {
		walkInterpolationFragment(ts, prefix + mapCode + suffix, (frag, fragOffset, isJustForErrorMapping) => {
			if (fragOffset === undefined) {
				tsCodeGen.addText(frag);
			}
			else {
				fragOffset -= prefix.length;
				let addSubfix = '';
				const overLength = fragOffset + frag.length - mapCode.length;
				if (overLength > 0) {
					addSubfix = frag.substring(frag.length - overLength);
					frag = frag.substring(0, frag.length - overLength);
				}
				if (fragOffset < 0) {
					tsCodeGen.addText(frag.substring(0, -fragOffset));
					frag = frag.substring(-fragOffset);
					fragOffset = 0;
				}
				if (sourceOffset !== undefined && data !== undefined) {
					writeCode(
						frag,
						{
							start: sourceOffset + fragOffset,
							end: sourceOffset + fragOffset + frag.length,
						},
						SourceMaps.Mode.Offset,
						isJustForErrorMapping
							? {
								vueTag: data.vueTag,
								capabilities: {
									diagnostic: true,
								},
							}
							: data,
					);
				}
				else {
					tsCodeGen.addText(frag);
				}
				tsCodeGen.addText(addSubfix);
			}
		}, localVars, identifiers);
	}
	function writeFormatCode(mapCode: string, sourceOffset: number, formatWrapper: [string, string]) {
		tsFormatCodeGen.addText(formatWrapper[0]);
		const targetRange = tsFormatCodeGen.addText(mapCode);
		addMapping(tsFormatCodeGen, {
			mappedRange: targetRange,
			sourceRange: {
				start: sourceOffset,
				end: sourceOffset + mapCode.length,
			},
			mode: SourceMaps.Mode.Offset,
			data: {
				vueTag: 'template',
				capabilities: {},
			},
		});
		tsFormatCodeGen.addText(formatWrapper[1]);
		tsFormatCodeGen.addText(`\n;\n`);
	}
	function writeCode(mapCode: string, sourceRange: SourceMaps.Range, mode: SourceMaps.Mode, data: EmbeddedFileMappingData) {
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

		const templateStart = htmlToTemplate(mapping.sourceRange)?.start;
		if (templateStart === undefined) return; // not found
		const offset = templateStart - mapping.sourceRange.start;
		newMapping.sourceRange = {
			start: mapping.sourceRange.start + offset,
			end: mapping.sourceRange.end + offset,
		};

		if (mapping.additional) {
			newMapping.additional = [];
			for (const other of mapping.additional) {
				let otherTemplateStart = htmlToTemplate(other.sourceRange)?.start;
				if (otherTemplateStart === undefined) continue;
				const otherOffset = otherTemplateStart - other.sourceRange.start;
				newMapping.additional.push({
					...other,
					sourceRange: {
						start: other.sourceRange.start + otherOffset,
						end: other.sourceRange.end + otherOffset,
					},
				});
			}
		}

		gen.addMapping2(newMapping);
	}
};

export function walkElementNodes(node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode, cb: (node: CompilerDOM.ElementNode) => void) {
	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		for (const child of node.children) {
			walkElementNodes(child, cb);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		const patchForNode = getPatchForSlotNode(node);
		if (patchForNode) {
			walkElementNodes(patchForNode, cb);
			return;
		}
		cb(node);
		for (const child of node.children) {
			walkElementNodes(child, cb);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.IF) {
		// v-if / v-else-if / v-else
		for (let i = 0; i < node.branches.length; i++) {
			const branch = node.branches[i];
			for (const childNode of branch.children) {
				walkElementNodes(childNode, cb);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.FOR) {
		// v-for
		for (const child of node.children) {
			walkElementNodes(child, cb);
		}
	}
}

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
	return newName;
}
// https://github.com/vuejs/vue-next/blob/master/packages/compiler-dom/src/transforms/vModel.ts#L49-L51
// https://v3.vuejs.org/guide/forms.html#basic-usage
function getModelValuePropName(node: CompilerDOM.ElementNode, vueVersion: number) {

	const tag = node.tag;
	const typeAttr = node.props.find(prop => prop.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop.name === 'type') as CompilerDOM.AttributeNode | undefined;
	const type = typeAttr?.value?.content;

	if (tag === 'input' && type === 'checkbox')
		return 'checked';

	if (
		tag === 'input' ||
		tag === 'textarea' ||
		tag === 'select' ||
		vueVersion < 3
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

import { CodeGen } from '@volar/code-gen';
import * as SourceMaps from '@volar/source-map';
import * as CompilerCore from '@vue/compiler-core';
import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize, hyphenate, isHTMLTag, isSVGTag } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { parseBindingRanges } from '../parsers/scriptSetupRanges';
import { EmbeddedFileMappingData } from '../sourceFile';
import { ResolvedVueCompilerOptions } from '../types';
import { SearchTexts } from '../utils/string';
import { colletVars, walkInterpolationFragment } from '../utils/transform';

// TODO: typecheck
const capabilitiesSet = {
	all: { hover: true, diagnostic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	noDiagnostic: { hover: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true },
	diagnosticOnly: { diagnostic: true },
	tagHover: { hover: true },
	event: { hover: true, diagnostic: true },
	tagReference: { references: true, definitions: true, rename: { normalize: undefined, apply: (_: string, newName: string) => newName } },
	attr: { hover: true, diagnostic: true, references: true, definitions: true, rename: true },
	attrReference: { references: true, definitions: true, rename: true },
	scopedClassName: { references: true, definitions: true, rename: true, completion: true },
	slotName: { hover: true, diagnostic: true, references: true, definitions: true, completion: true },
	slotNameExport: { hover: true, diagnostic: true, references: true, definitions: true, /* referencesCodeLens: true */ },
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
const transformContext: CompilerDOM.TransformContext = {
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

export function isIntrinsicElement(runtimeMode: 'runtime-dom' | 'runtime-uni-app', tag: string) {
	return runtimeMode === 'runtime-dom' ? (_isHTMLTag(tag) || isSVGTag(tag)) : ['block', 'component', 'template', 'slot'].includes(tag);
}

export function generate(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	vueCompilerOptions: ResolvedVueCompilerOptions,
	sourceTemplate: string,
	sourceLang: string,
	templateAst: CompilerDOM.RootNode,
	hasScriptSetup: boolean,
	cssScopedClasses: string[] = [],
) {

	const codeGen = new CodeGen<EmbeddedFileMappingData>();
	const formatCodeGen = new CodeGen<EmbeddedFileMappingData>();
	const cssCodeGen = new CodeGen<EmbeddedFileMappingData>();
	const slots = new Map<string, {
		varName: string,
		loc: SourceMaps.Range,
		nodeLoc: any,
	}>();
	const slotExps = new Map<string, {
		varName: string,
	}>();
	const cssScopedClassesSet = new Set(cssScopedClasses);
	const tagNames = collectTagOffsets();
	const localVars: Record<string, number> = {};
	const tempVars: ReturnType<typeof walkInterpolationFragment>[] = [];
	const identifiers = new Set<string>();
	const scopedClasses: { className: string, offset: number; }[] = [];
	const blockConditions: string[] = [];

	let slotsNum = 0;
	let elementIndex = 0;

	formatCodeGen.addText('export { };\n');

	const tagResolves = writeComponentCompletionSearchTexts();

	visitNode(templateAst, undefined);

	writeStyleScopedClasses();

	declareSlots();

	writeInterpolationVarsExtraCompletion();

	return {
		codeGen,
		formatCodeGen,
		cssCodeGen,
		tagNames,
		identifiers,
		slotsNum,
	};

	function declareSlots() {

		codeGen.addText(`declare var __VLS_slots:\n`);
		for (const [exp, slot] of slotExps) {
			codeGen.addText(`Record<NonNullable<typeof ${exp}>, typeof ${slot.varName}> &\n`);
		}
		codeGen.addText(`{\n`);
		for (const [name, slot] of slots) {
			slotsNum++;
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
				slot.nodeLoc,
			);
			codeGen.addText(`: (_: typeof ${slot.varName}) => any,\n`);
		}
		codeGen.addText(`};\n`);
	}
	function writeStyleScopedClasses() {

		codeGen.addText(`if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {\n`);
		for (const { className, offset } of scopedClasses) {
			codeGen.addText(`__VLS_styleScopedClasses[`);
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
			codeGen.addText(`];\n`);
		}
		codeGen.addText('}\n');
	}
	function writeComponentCompletionSearchTexts() {

		const data: Record<string, {
			component: string,
			isNamespacedTag: boolean,
		} | undefined> = {};

		for (const tagName in tagNames) {

			if (isIntrinsicElement(vueCompilerOptions.experimentalRuntimeMode, tagName))
				continue;

			const tagOffsets = tagNames[tagName];
			const tagRanges = tagOffsets.map(offset => ({ start: offset, end: offset + tagName.length }));
			const isNamespacedTag = tagName.indexOf('.') >= 0;

			const var_componentVar = isNamespacedTag ? `__VLS_ctx.${tagName}` : capitalize(camelize(tagName.replace(/:/g, '-')));

			if (isNamespacedTag) {

				identifiers.add(tagName.split('.')[0]);

				for (let i = 0; i < tagRanges.length; i++) {
					const tagRange = tagRanges[i];
					codeGen.addText(`declare const __VLS_${elementIndex++}: typeof __VLS_ctx.`);
					writeCode(
						tagName,
						tagRange,
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
					);
					codeGen.addText(`;\n`);
				}
			}
			else {

				const names = new Set([
					tagName,
					camelize(tagName),
					capitalize(camelize(tagName)),
				]);

				codeGen.addText(`declare const ${var_componentVar}: `);

				if (!vueCompilerOptions.strictTemplates)
					codeGen.addText(`import('./__VLS_types.js').ConvertInvalidJsxElement<`);

				for (const name of names) {
					codeGen.addText(`\n'${name}' extends keyof typeof __VLS_components ? typeof __VLS_components['${name}'] : `);
				}
				for (const name of names) {
					codeGen.addText(`\n'${name}' extends keyof typeof __VLS_ctx ? typeof __VLS_ctx['${name}'] : `);
				}

				codeGen.addText(`unknown`);

				if (!vueCompilerOptions.strictTemplates)
					codeGen.addText(`>`);

				codeGen.addText(`;\n`);

				for (const vlsVar of ['__VLS_components', '__VLS_ctx']) {
					for (const tagRange of tagRanges) {
						for (const name of names) {
							codeGen.addText(vlsVar);
							writePropertyAccess2(
								name,
								[tagRange],
								{
									vueTag: 'template',
									capabilities: {
										...capabilitiesSet.tagReference,
										rename: {
											normalize: tagName === name ? capabilitiesSet.tagReference.rename.normalize : unHyphenatComponentName,
											apply: keepHyphenateName,
										},
									},
								},
							);
							codeGen.addText(';');
						}
						codeGen.addText('\n');
					}
				}
			}

			const componentNames = new Set([
				tagName, // hello-world
				camelize(tagName), // helloWorld
				capitalize(camelize(tagName)), // HelloWorld
			]);

			/* Completion */
			codeGen.addText('/* Completion: Emits */\n');
			for (const name of componentNames) {
				codeGen.addText('// @ts-ignore\n');
				codeGen.addText(`({} as import('./__VLS_types.js').ExtractEmit2<typeof ${var_componentVar}>)('${SearchTexts.EmitCompletion(name)}');\n`);
			}

			codeGen.addText('/* Completion: Props */\n');
			for (const name of componentNames) {
				codeGen.addText('// @ts-ignore\n');
				codeGen.addText(`({} as import('./__VLS_types.js').ExtractProps<typeof ${var_componentVar}>)['${SearchTexts.PropsCompletion(name)}'];\n`);
			}

			data[tagName] = {
				component: var_componentVar,
				isNamespacedTag,
			};
		}

		return data;
	}
	function collectTagOffsets() {

		const tagOffsetsMap: Record<string, number[]> = {};

		walkElementNodes(templateAst, node => {

			if (!tagOffsetsMap[node.tag]) {
				tagOffsetsMap[node.tag] = [];
			}

			const offsets = tagOffsetsMap[node.tag];
			const source = sourceTemplate.substring(node.loc.start.offset);

			offsets.push(node.loc.start.offset + source.indexOf(node.tag)); // start tag
			if (!node.isSelfClosing && sourceLang === 'html') {
				offsets.push(node.loc.start.offset + node.loc.source.lastIndexOf(node.tag)); // end tag
			}
		});

		return tagOffsetsMap;
	}
	function createTsAst(cacheTo: any, text: string) {
		if (cacheTo.__volar_ast_text !== text) {
			cacheTo.__volar_ast_text = text;
			cacheTo.__volar_ast = ts.createSourceFile('/a.ts', text, ts.ScriptTarget.ESNext);
		}
		return cacheTo.__volar_ast as ts.SourceFile;
	}
	function visitNode(node: CompilerCore.RootNode | CompilerDOM.TemplateChildNode, parentEl: CompilerDOM.ElementNode | undefined): void {
		if (node.type === CompilerDOM.NodeTypes.ROOT) {
			for (const childNode of node.children) {
				visitNode(childNode, parentEl);
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
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

			let content = node.content.loc.source;
			let start = node.content.loc.start.offset;
			let leftCharacter: string;
			let rightCharacter: string;

			// fix https://github.com/johnsoncodehk/volar/issues/1787
			while ((leftCharacter = sourceTemplate.substring(start - 1, start)).trim() === '' && leftCharacter.length) {
				start--;
				content = leftCharacter + content;
			}
			while ((rightCharacter = sourceTemplate.substring(start + content.length, start + content.length + 1)).trim() === '' && rightCharacter.length) {
				content = content + rightCharacter;
			}

			writeInterpolation(
				content,
				start,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.all,
				},
				'(',
				');\n',
				node.content.loc,
			);
			writeInterpolationVarsExtraCompletion();
			writeFormatCode(
				content,
				start,
				formatBrackets.curly,
			);
		}
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			// v-if / v-else-if / v-else

			let originalBlockConditionsLength = blockConditions.length;

			for (let i = 0; i < node.branches.length; i++) {

				const branch = node.branches[i];

				if (i === 0)
					codeGen.addText('if');
				else if (branch.condition)
					codeGen.addText('else if');
				else
					codeGen.addText('else');

				let addedBlockCondition = false;

				if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					codeGen.addText(` `);
					writeInterpolation(
						branch.condition.content,
						branch.condition.loc.start.offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						'(',
						')',
						branch.condition.loc,
					);
					writeFormatCode(
						branch.condition.content,
						branch.condition.loc.start.offset,
						formatBrackets.round,
					);

					if (vueCompilerOptions.experimentalAllowTypeNarrowingInInlineHandlers) {
						blockConditions.push(branch.condition.content);
						addedBlockCondition = true;
					}
				}

				codeGen.addText(` {\n`);
				writeInterpolationVarsExtraCompletion();
				for (const childNode of branch.children) {
					visitNode(childNode, parentEl);
				}
				codeGen.addText('}\n');

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

			codeGen.addText(`for (const [`);
			if (leftExpressionRange && leftExpressionText) {

				const collentAst = createTsAst(node.parseResult, `const [${leftExpressionText}]`);
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
			codeGen.addText(`] of (await import('./__VLS_types.js')).getVforSourceType`);
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
					source.loc,
				);
				writeFormatCode(
					source.content,
					source.loc.start.offset,
					formatBrackets.empty,
				);

				codeGen.addText(`) {\n`);

				writeInterpolationVarsExtraCompletion();

				for (const childNode of node.children) {
					visitNode(childNode, parentEl);
				}

				codeGen.addText('}\n');
			}

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
			codeGen.addText(`// Unprocessed node type: ${node.type} json: ${JSON.stringify(node.loc)}\n`);
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

		if (node.tag === 'vls-sr') {

			const startTagEnd = node.loc.source.indexOf('>') + 1;
			const endTagStart = node.loc.source.lastIndexOf('</');
			const scriptCode = node.loc.source.substring(startTagEnd, endTagStart);
			const collentAst = createTsAst(node, scriptCode);
			const bindings = parseBindingRanges(ts, collentAst, false);
			const scriptVars = bindings.map(binding => scriptCode.substring(binding.start, binding.end));

			for (const varName of scriptVars)
				localVars[varName] = (localVars[varName] ?? 0) + 1;

			writeCode(
				scriptCode,
				{
					start: node.loc.start.offset + startTagEnd,
					end: node.loc.start.offset + startTagEnd + scriptCode.length,
				},
				SourceMaps.Mode.Offset,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.all,
				},
			);
			return;
		}

		codeGen.addText(`{\n`);

		const startTagOffset = node.loc.start.offset + sourceTemplate.substring(node.loc.start.offset).indexOf(node.tag);
		const endTagOffset = !node.isSelfClosing && sourceLang === 'html' ? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) : undefined;

		let _unwritedExps: CompilerCore.SimpleExpressionNode[];

		if (vueCompilerOptions.jsxTemplates) {

			const _isIntrinsicElement = isIntrinsicElement(vueCompilerOptions.experimentalRuntimeMode, node.tag);
			const tagText = tagResolves[node.tag]?.component ?? node.tag;
			const fullTagStart = codeGen.getText().length;
			const tagCapabilities = {
				...capabilitiesSet.diagnosticOnly,
				...(tagResolves[node.tag]?.isNamespacedTag ? {} : capabilitiesSet.tagHover),
				...(_isIntrinsicElement ? capabilitiesSet.tagReference : {})
			};

			codeGen.addText(`<`);
			writeCode(
				tagText,
				{
					start: startTagOffset,
					end: startTagOffset + node.tag.length,
				},
				SourceMaps.Mode.Offset,
				{
					vueTag: 'template',
					capabilities: tagCapabilities,
				},
			);
			codeGen.addText(` `);
			const { hasRemainStyleOrClass, unwritedExps } = writeProps(node, false, 'jsx', 'props');
			_unwritedExps = unwritedExps;

			if (endTagOffset === undefined) {
				codeGen.addText(`/>`);
			}
			else {
				codeGen.addText(`></`);
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
				codeGen.addText(`>;\n`);
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
			codeGen.addMapping2({
				sourceRange: {
					start: node.loc.start.offset,
					end: startTagEnd,
				},
				mappedRange: {
					start: fullTagStart,
					end: codeGen.getText().length,
				},
				mode: SourceMaps.Mode.Totally,
				data: {
					vueTag: 'template',
					capabilities: capabilitiesSet.diagnosticOnly,
				},
			});
			codeGen.addText(`\n`);

			if (hasRemainStyleOrClass) {
				codeGen.addText(`<${tagText} `);
				writeProps(node, true, 'jsx', 'props');
				codeGen.addText(`/>\n`);
			}
		}
		else {

			const tag = tagResolves[node.tag];
			const var_props = `__VLS_${elementIndex++}`;

			codeGen.addText(`let ${var_props}!: `);

			if (!tag) {
				codeGen.addText(`JSX.IntrinsicElements['`);
				writeCode(
					node.tag,
					{
						start: startTagOffset,
						end: startTagOffset + node.tag.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.tagReference,
					},
				);
				codeGen.addText(`'];\n`);
			}
			else {
				if (!vueCompilerOptions.strictTemplates) {
					codeGen.addText(`Record<string, unknown> & `);
				}
				codeGen.addText(`import('./__VLS_types.js').GlobalAttrs & import('./__VLS_types.js').ExtractProps<typeof ${tag.component}>;\n`);

				if (!tag.isNamespacedTag) {
					writeCode(
						tag.component,
						{
							start: startTagOffset,
							end: startTagOffset + node.tag.length,
						},
						SourceMaps.Mode.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.tagHover,
						},
					);
					codeGen.addText(`;\n`);
					if (endTagOffset !== undefined) {
						writeCode(
							tag.component,
							{
								start: endTagOffset,
								end: endTagOffset + node.tag.length,
							},
							SourceMaps.Mode.Offset,
							{
								vueTag: 'template',
								capabilities: capabilitiesSet.tagHover,
							},
						);
						codeGen.addText(`;\n`);
					}
				}
			}

			writeCode(
				var_props,
				{
					start: startTagOffset,
					end: startTagOffset + node.tag.length,
				},
				SourceMaps.Mode.Offset,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.diagnosticOnly,
				},
			);
			codeGen.addText(` = { `);
			const { hasRemainStyleOrClass, unwritedExps } = writeProps(node, false, 'class', 'props');
			_unwritedExps = unwritedExps;
			codeGen.addText(` };\n`);

			if (hasRemainStyleOrClass) {
				codeGen.addText(`${var_props} = { `);
				writeProps(node, true, 'class', 'props');
				codeGen.addText(` };\n`);
			}
		}
		{

			// fix https://github.com/johnsoncodehk/volar/issues/1775
			for (const failedExp of _unwritedExps) {
				writeInterpolation(
					failedExp.loc.source,
					failedExp.loc.start.offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
					'(',
					')',
					failedExp.loc,
				);
				const fb = formatBrackets.round;
				if (fb) {
					writeFormatCode(
						failedExp.loc.source,
						failedExp.loc.start.offset,
						fb,
					);
				}
				codeGen.addText(';\n');
			}

			let slotBlockVars: string[] | undefined;

			writeInlineCss(node);

			slotBlockVars = [];
			writeImportSlots(node, parentEl, slotBlockVars);

			for (const varName of slotBlockVars)
				localVars[varName] = (localVars[varName] ?? 0) + 1;

			const vScope = node.props.find(prop => prop.type === CompilerDOM.NodeTypes.DIRECTIVE && (prop.name === 'scope' || prop.name === 'data'));
			let inScope = false;
			let originalConditionsNum = blockConditions.length;

			if (vScope?.type === CompilerDOM.NodeTypes.DIRECTIVE && vScope.exp) {

				const scopeVar = `__VLS_${elementIndex++}`;
				const condition = `(await import('./__VLS_types.js')).withScope(__VLS_ctx, ${scopeVar})`;

				codeGen.addText(`const ${scopeVar} = `);
				writeCode(
					vScope.exp.loc.source,
					{
						start: vScope.exp.loc.start.offset,
						end: vScope.exp.loc.end.offset,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
				);
				codeGen.addText(';\n');
				codeGen.addText(`if (${condition}) {\n`);
				blockConditions.push(condition);
				inScope = true;
			}

			writeDirectives(node);
			writeElReferences(node); // <el ref="foo" />
			if (cssScopedClasses.length) writeClassScopeds(node);
			writeEvents(node);
			writeSlots(node, startTagOffset);

			for (const childNode of node.children) {
				visitNode(childNode, parentEl);
			}

			if (slotBlockVars) {
				for (const varName of slotBlockVars)
					localVars[varName]--;
			}

			if (inScope) {
				codeGen.addText('}\n');
				blockConditions.length = originalConditionsNum;
			}
		}
		codeGen.addText(`}\n`);
	}
	function writeEvents(node: CompilerDOM.ElementNode) {

		const varComponentInstance = `__VLS_${elementIndex++}`;
		let writedInstance = false;

		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {

				tryWriteInstance();

				const tag = tagResolves[node.tag];
				const varInstanceProps = `__VLS_${elementIndex++}`;

				if (tag) {
					codeGen.addText(`type ${varInstanceProps} = typeof ${varComponentInstance} extends { $props: infer Props } ? Props & Record<string, unknown> : typeof ${tag.component} & Record<string, unknown>;\n`);
				}

				codeGen.addText(`const __VLS_${elementIndex++}: {\n`);
				codeGen.addText(`'${prop.arg.loc.source}': import('./__VLS_types.js').FillingEventArg<\n`);
				{

					const key_2 = camelize('on-' + prop.arg.loc.source); // onClickOutside
					const key_3 = 'on' + capitalize(prop.arg.loc.source); // onClick-outside

					if (tag) {

						codeGen.addText(`import('./__VLS_types.js').FirstFunction<\n`);

						{
							codeGen.addText(`import('./__VLS_types.js').EmitEvent<typeof ${tag.component}, '${prop.arg.loc.source}'>,\n`);
						}

						{
							codeGen.addText(`${varInstanceProps}[`);
							writeCodeWithQuotes(
								key_2,
								[{ start: prop.arg.loc.start.offset, end: prop.arg.loc.end.offset }],
								{
									vueTag: 'template',
									capabilities: {
										...capabilitiesSet.attrReference,
										rename: {
											normalize(newName) {
												return camelize('on-' + newName);
											},
											apply(oldName, newName) {
												const hName = hyphenate(newName);
												if (hyphenate(newName).startsWith('on-')) {
													return camelize(hName.slice('on-'.length));
												}
												return newName;
											},
										},
									},
								},
							);
							codeGen.addText(`],\n`);
						}

						{
							if (key_3 !== key_2) {
								codeGen.addText(`${varInstanceProps}[`);
								writeCodeWithQuotes(
									key_3,
									[{ start: prop.arg.loc.start.offset, end: prop.arg.loc.end.offset }],
									{
										vueTag: 'template',
										capabilities: {
											...capabilitiesSet.attrReference,
											rename: {
												normalize(newName) {
													return 'on' + capitalize(newName);
												},
												apply(oldName, newName) {
													const hName = hyphenate(newName);
													if (hyphenate(newName).startsWith('on-')) {
														return camelize(hName.slice('on-'.length));
													}
													return newName;
												},
											},
										},
									},
								);
								codeGen.addText(`],\n`);
							}
						}

						{
							codeGen.addText(`typeof ${varComponentInstance} extends { $emit: infer Emit } ? import('./__VLS_types.js').EmitEvent2<Emit, '${prop.arg.loc.source}'> : unknown,\n`);
						}
					}

					{
						codeGen.addText(`import('./__VLS_types.js').GlobalAttrs[`);
						writeCodeWithQuotes(
							key_2,
							[{ start: prop.arg.loc.start.offset, end: prop.arg.loc.end.offset }],
							{
								vueTag: 'template',
								capabilities: {
									...capabilitiesSet.attrReference,
									rename: {
										normalize(newName) {
											return camelize('on-' + newName);
										},
										apply(oldName, newName) {
											const hName = hyphenate(newName);
											if (hyphenate(newName).startsWith('on-')) {
												return camelize(hName.slice('on-'.length));
											}
											return newName;
										},
									}
								},
							},
						);
						codeGen.addText(`],\n`);
					}

					if (tag) {
						codeGen.addText(`>\n`);
					}
				}
				codeGen.addText(`>\n`);
				codeGen.addText(`} = {\n`);
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
						prop.arg.loc,
					);
					codeGen.addText(`: `);
					appendExpressionNode(prop);
				}
				codeGen.addText(`};\n`);
				writeInterpolationVarsExtraCompletion();
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
					prop.exp.loc,
				);
				writeFormatCode(
					prop.exp.content,
					prop.exp.loc.start.offset,
					formatBrackets.round,
				);
				codeGen.addText(`;\n`);
			}

			function appendExpressionNode(prop: CompilerDOM.DirectiveNode) {
				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {

					const ast = createTsAst(prop.exp, prop.exp.content);
					let isCompoundExpession = true;

					if (ast.getChildCount() === 2) { // with EOF 
						ast.forEachChild(child_1 => {
							if (ts.isExpressionStatement(child_1)) {
								child_1.forEachChild(child_2 => {
									if (ts.isArrowFunction(child_2)) {
										isCompoundExpession = false;
									}
									else if (ts.isIdentifier(child_2)) {
										isCompoundExpession = false;
									}
								});
							}
							else if (ts.isFunctionDeclaration(child_1)) {
								isCompoundExpession = false;
							}
						});
					}

					let prefix = '(';
					let suffix = ')';

					if (isCompoundExpession) {

						prefix = '$event => {\n';
						if (blockConditions.length) {
							for (const blockCondition of blockConditions) {
								prefix += `if (!(${blockCondition})) return;\n`;
							}
						}
						suffix = '\n}';
					}

					writeInterpolation(
						prop.exp.content,
						prop.exp.loc.start.offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						prefix,
						suffix,
						prop.exp.loc,
					);
					writeFormatCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						formatBrackets.round,
					);
				}
				else {
					codeGen.addText(`undefined`);
				}
			}
		}

		writeInterpolationVarsExtraCompletion();

		function tryWriteInstance() {

			if (writedInstance)
				return;

			const tag = tagResolves[node.tag];

			if (tag) {
				codeGen.addText(`const ${varComponentInstance} = new ${tag.component}({ `);
				writeProps(node, false, 'class', 'slots');
				codeGen.addText(`});\n`);
			}

			writedInstance = true;
		}
	}
	function writeProps(node: CompilerDOM.ElementNode, forRemainStyleOrClass: boolean, format: 'jsx' | 'class', mode: 'props' | 'slots') {

		let styleCount = 0;
		let classCount = 0;
		const unwritedExps: CompilerDOM.SimpleExpressionNode[] = [];

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
						: getModelValuePropName(node, vueCompilerOptions.target);

				if (propName_1 === undefined) {
					if (prop.exp) {
						unwritedExps.push(prop.exp);
					}
					continue;
				}

				if (prop.modifiers.some(m => m === 'prop' || m === 'attr')) {
					propName_1 = propName_1.substring(1);
				}

				const propName_2 = !isStatic ? propName_1 : hyphenate(propName_1) === propName_1 ? camelize(propName_1) : propName_1;

				if (vueCompilerOptions.strictTemplates) {
					propName_1 = propName_2;
				}

				if (forRemainStyleOrClass && propName_2 !== 'style' && propName_2 !== 'class')
					continue;

				if (propName_2 === 'style' || propName_2 === 'class') {
					const index = propName_2 === 'style' ? styleCount++ : classCount++;
					if (index >= 1 !== forRemainStyleOrClass)
						continue;
				}

				// camelize name
				writePropStart(isStatic);
				const diagStart = codeGen.getText().length;
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
						(prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}),
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
							capabilities: {
								...getCaps(capabilitiesSet.attr),
								rename: {
									normalize: camelize,
									apply: keepHyphenateName,
								},
							},
						},
						(prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {}),
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
							capabilities: {
								...getCaps(capabilitiesSet.attr),
								rename: {
									normalize: camelize,
									apply: keepHyphenateName,
								},
							},
						},
						(prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {}),
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
						prop.exp.loc,
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
					codeGen.addText('{}');
				}
				writePropValueSuffix(isStatic);
				codeGen.addMapping2({
					sourceRange: {
						start: prop.loc.start.offset,
						end: prop.loc.end.offset,
					},
					mappedRange: {
						start: diagStart,
						end: codeGen.getText().length,
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
							capabilities: {
								...getCaps(capabilitiesSet.attr),
								rename: {
									normalize: camelize,
									apply: keepHyphenateName,
								},
							},
						},
						(prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}),
					);
					writePropValuePrefix(isStatic);
					if (prop.exp) {
						writeInterpolation(
							prop.exp.loc.source,
							undefined,
							undefined,
							'(',
							')',
							prop.exp.loc,
						);
					}
					else {
						codeGen.addText('undefined');
					}
					writePropValueSuffix(isStatic);
					writePropEnd(isStatic);
				}
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			) {

				const propName = hyphenate(prop.name) === prop.name ? camelize(prop.name) : prop.name;
				let propName2 = prop.name;

				if (vueCompilerOptions.strictTemplates) {
					propName2 = propName;
				}

				if (forRemainStyleOrClass && propName !== 'style' && propName !== 'class')
					continue;

				if (propName === 'style' || propName === 'class') {
					const index = propName === 'style' ? styleCount++ : classCount++;
					if (index >= 1 !== forRemainStyleOrClass)
						continue;
				}

				// camelize name
				writePropStart(true);
				const diagStart = codeGen.getText().length;
				writePropName(
					propName,
					true,
					{
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + propName2.length,
					},
					{
						vueTag: 'template',
						capabilities: {
							...getCaps(capabilitiesSet.attr),
							rename: {
								normalize: camelize,
								apply: keepHyphenateName,
							},
						},
					},
					(prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}),
				);
				writePropValuePrefix(true);
				if (prop.value) {
					writeAttrValue(prop.value);
				}
				else {
					codeGen.addText('true');
				}
				writePropValueSuffix(true);
				writePropEnd(true);
				const diagEnd = codeGen.getText().length;
				codeGen.addMapping2({
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
							capabilities: {
								...getCaps(capabilitiesSet.attr),
								rename: {
									normalize: camelize,
									apply: keepHyphenateName,
								},
							},
						},
						(prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {}),
					);
					writePropValuePrefix(true);
					if (prop.value) {
						writeAttrValue(prop.value);
					}
					else {
						codeGen.addText('true');
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
				if (format === 'jsx')
					codeGen.addText('{...');
				else
					codeGen.addText('...');
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					{
						vueTag: 'template',
						capabilities: getCaps(capabilitiesSet.all),
					},
					'(',
					')',
					prop.exp.loc,
				);
				const fb = getFormatBrackets(formatBrackets.round);
				if (fb) {
					writeFormatCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						fb,
					);
				}
				if (format === 'jsx')
					codeGen.addText('} ');
				else
					codeGen.addText(', ');
			}
			else {
				if (forRemainStyleOrClass) {
					continue;
				}
				// comment this line to avoid affecting comments in prop expressions
				// tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */ ");
			}
		}

		return {
			hasRemainStyleOrClass: styleCount >= 2 || classCount >= 2,
			unwritedExps,
		};

		function writePropName(name: string, isStatic: boolean, sourceRange: SourceMaps.Range, data: EmbeddedFileMappingData, cacheOn: any) {
			if (format === 'jsx' && isStatic) {
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
					cacheOn,
				);
			}
		}
		function writePropValuePrefix(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codeGen.addText('={');
			}
			else {
				codeGen.addText(': (');
			}
		}
		function writePropValueSuffix(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codeGen.addText('}');
			}
			else {
				codeGen.addText(')');
			}
		}
		function writePropStart(isStatic: boolean) {
			if (format === 'jsx' && !isStatic) {
				codeGen.addText('{...{');
			}
		}
		function writePropEnd(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codeGen.addText(' ');
			}
			else if (format === 'jsx' && !isStatic) {
				codeGen.addText('}} ');
			}
			else {
				codeGen.addText(', ');
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
			if (format === 'jsx') {
				return b;
			}
			else {
				return undefined;
			}
		}
		function writeAttrValue(attrNode: CompilerDOM.TextNode) {
			codeGen.addText('"');
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
			codeGen.addText('"');
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

				cssCodeGen.addText(`${node.tag} { `);
				cssCodeGen.addCode2(
					content,
					prop.arg.loc.start.offset + start,
					{
						vueTag: 'template',
						capabilities: {
							hover: true,
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
	function writeImportSlots(node: CompilerDOM.ElementNode, parentEl: CompilerDOM.ElementNode | undefined, slotBlockVars: string[]) {

		const tag = parentEl ? tagResolves[parentEl.tag] : undefined;

		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'slot'
			) {

				const varComponentInstance = `__VLS_${elementIndex++}`;
				const varSlots = `__VLS_${elementIndex++}`;

				if (tag && parentEl) {
					codeGen.addText(`const ${varComponentInstance} = new ${tag.component}({ `);
					writeProps(parentEl, false, 'class', 'slots');
					codeGen.addText(`});\n`);
					writeInterpolationVarsExtraCompletion();
					codeGen.addText(`declare const ${varSlots}: import('./__VLS_types.js').ExtractComponentSlots<typeof ${varComponentInstance}>;\n`);
				}

				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					codeGen.addText(`const `);

					const collentAst = createTsAst(prop, `const ${prop.exp.content}`);
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

					codeGen.addText(` = `);
				}

				if (!tag || !parentEl) {
					// fix https://github.com/johnsoncodehk/volar/issues/1425
					codeGen.addText(`{} as any;\n`);
					continue;
				}

				let slotName = 'default';
				let isStatic = true;
				if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.content !== '') {
					isStatic = prop.arg.isStatic;
					slotName = prop.arg.content;
				}
				const diagStart = codeGen.getText().length;
				codeGen.addText(varSlots);
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
					codeGen.addText(`[`);
					writeInterpolation(
						slotName,
						argRange.start + 1,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
						'',
						'',
						(prop.loc as any).slot_name ?? ((prop.loc as any).slot_name = {}),
					);
					codeGen.addText(`]`);
					writeInterpolationVarsExtraCompletion();
				}
				const diagEnd = codeGen.getText().length;
				codeGen.addMapping2({
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
				codeGen.addText(`;\n`);

				if (isStatic && !prop.arg) {

					let offset = prop.loc.start.offset;

					if (prop.loc.source.startsWith('#'))
						offset += '#'.length;
					else if (prop.loc.source.startsWith('v-slot:'))
						offset += 'v-slot:'.length;

					codeGen.addText(varSlots);
					codeGen.addText(`['`);
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
					codeGen.addText(`'];\n`);
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
				&& (prop.name !== 'scope' && prop.name !== 'data')
			) {

				const diagStart = codeGen.getText().length;
				codeGen.addText(`(await import('./__VLS_types.js')).directiveFunction(__VLS_ctx.`);
				writeCode(
					camelize('v-' + prop.name),
					{
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + 'v-'.length + prop.name.length,
					},
					SourceMaps.Mode.Offset,
					{
						vueTag: 'template',
						capabilities: {
							...capabilitiesSet.noDiagnostic,
							rename: {
								normalize: camelize,
								apply: keepHyphenateName,
							},
						},
					},
				);
				identifiers.add(camelize('v-' + prop.name));
				codeGen.addText(`)(`);
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
						prop.exp.loc,
					);
					writeFormatCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						formatBrackets.round,
					);
				}
				codeGen.addText(`)`);
				codeGen.addMapping2({
					sourceRange: {
						start: prop.loc.start.offset,
						end: prop.loc.end.offset,
					},
					mappedRange: {
						start: diagStart,
						end: codeGen.getText().length,
					},
					mode: SourceMaps.Mode.Totally,
					data: {
						vueTag: 'template',
						capabilities: capabilitiesSet.diagnosticOnly,
					},
				});
				codeGen.addText(`;\n`);
				writeInterpolationVarsExtraCompletion();
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
				codeGen.addText(`// @ts-ignore\n`);
				writeInterpolation(
					prop.value.content,
					prop.value.loc.start.offset + 1,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.refAttr,
					},
					'(',
					')',
					prop.value.loc,
				);
				codeGen.addText(`;\n`);
				writeInterpolationVarsExtraCompletion();
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
				codeGen.addText(`__VLS_styleScopedClasses = (`);
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
				codeGen.addText(`);\n`);
			}
		}
	}
	function writeSlots(node: CompilerDOM.ElementNode, startTagOffset: number) {

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
				codeGen.addText(`const ${varDefaultBind} = `);
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.attrReference,
					},
					'(',
					')',
					prop.exp.loc,
				);
				codeGen.addText(`;\n`);
				writeInterpolationVarsExtraCompletion();
				break;
			}
		}

		codeGen.addText(`const ${varBinds} = {\n`);
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
						capabilities: {
							...capabilitiesSet.attrReference,
							rename: {
								normalize: camelize,
								apply: keepHyphenateName,
							},
						},
					},
					prop.arg.loc,
				);
				codeGen.addText(`: `);
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.attrReference,
					},
					'(',
					')',
					prop.exp.loc,
				);
				codeGen.addText(`,\n`);
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
						capabilities: {
							...capabilitiesSet.attr,
							rename: {
								normalize: camelize,
								apply: keepHyphenateName,
							},
						},
					},
					prop.loc,
				);
				codeGen.addText(`: (`);
				codeGen.addText(propValue);
				codeGen.addText(`),\n`);
			}
		}
		codeGen.addText(`};\n`);

		writeInterpolationVarsExtraCompletion();

		if (hasDefaultBind) {
			codeGen.addText(`var ${varSlot}!: typeof ${varDefaultBind} & typeof ${varBinds};\n`);
		}
		else {
			codeGen.addText(`var ${varSlot}!: typeof ${varBinds};\n`);
		}

		if (slotNameExp) {
			const varSlotExp = `__VLS_${elementIndex++}`;
			const varSlotExp2 = `__VLS_${elementIndex++}`;
			codeGen.addText(`const ${varSlotExp} = ${slotNameExp};\n`);
			codeGen.addText(`var ${varSlotExp2}!: typeof ${varSlotExp};\n`);
			slotExps.set(varSlotExp2, {
				varName: varSlot,
			});
		}
		else {
			slots.set(slotName, {
				varName: varSlot,
				loc: {
					start: startTagOffset,
					end: startTagOffset + node.tag.length,
				},
				nodeLoc: node.loc,
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
	function writeObjectProperty(mapCode: string, sourceRange: SourceMaps.Range, mapMode: SourceMaps.Mode, data: EmbeddedFileMappingData, cacheOn: any) {
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
				cacheOn,
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
				codeGen.addMapping2({
					sourceRange,
					mappedRange: {
						start: codeGen.getText().length - mapCode.length,
						end: codeGen.getText().length,
					},
					mode: sourceRange.end - sourceRange.start === mapCode.length ? SourceMaps.Mode.Offset : SourceMaps.Mode.Expand,
					data,
				});
			}
			else if (mode === 3) {
				codeGen.addMapping2({
					sourceRange,
					mappedRange: {
						start: codeGen.getText().length - `['${mapCode}']`.length,
						end: codeGen.getText().length - `']`.length,
					},
					mode: SourceMaps.Mode.Offset,
					additional: [
						{
							sourceRange,
							mappedRange: {
								start: codeGen.getText().length - `'${mapCode}']`.length,
								end: codeGen.getText().length - `]`.length,
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
			codeGen.addText(`.`);
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
			codeGen.addText(`[`);
			writeCodeWithQuotes(mapCode, sourceRange, data);
			codeGen.addText(`]`);
			return 3;
		}
	}
	function writeCodeWithQuotes(mapCode: string, sourceRanges: SourceMaps.Range | SourceMaps.Range[], data: EmbeddedFileMappingData) {
		const addText = `'${mapCode}'`;
		for (const sourceRange of 'length' in sourceRanges ? sourceRanges : [sourceRanges]) {
			codeGen.addMapping2({
				sourceRange,
				mappedRange: {
					start: codeGen.getText().length + 1,
					end: codeGen.getText().length + addText.length - 1,
				},
				mode: SourceMaps.Mode.Offset,
				additional: [
					{
						sourceRange,
						mappedRange: {
							start: codeGen.getText().length,
							end: codeGen.getText().length + addText.length,
						},
						mode: SourceMaps.Mode.Totally,
					}
				],
				data,
			});
		}
		codeGen.addText(addText);
	}
	function writeInterpolation(
		mapCode: string,
		sourceOffset: number | undefined,
		data: EmbeddedFileMappingData | undefined,
		prefix: string,
		suffix: string,
		cacheOn: any,
	) {
		const ast = createTsAst(cacheOn, prefix + mapCode + suffix);
		const vars = walkInterpolationFragment(ts, prefix + mapCode + suffix, ast, (frag, fragOffset, isJustForErrorMapping) => {
			if (fragOffset === undefined) {
				codeGen.addText(frag);
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
					codeGen.addText(frag.substring(0, -fragOffset));
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
					codeGen.addText(frag);
				}
				codeGen.addText(addSubfix);
			}
		}, localVars, identifiers);
		if (sourceOffset !== undefined) {
			for (const v of vars) {
				v.offset = sourceOffset + v.offset - prefix.length;
			}
			if (vars.length) {
				tempVars.push(vars);
			}
		}
	}
	function writeInterpolationVarsExtraCompletion() {

		if (!tempVars.length)
			return;

		codeGen.addText('[');
		for (const _vars of tempVars) {
			for (const v of _vars) {
				codeGen.addCode2(v.text, v.offset, {
					vueTag: 'template',
					capabilities: {
						completion: {
							additional: true,
						},
					},
				});
				codeGen.addText(',');
			}
		}
		codeGen.addText('];\n');
		tempVars.length = 0;
	}
	function writeFormatCode(mapCode: string, sourceOffset: number, formatWrapper: [string, string]) {
		formatCodeGen.addText(formatWrapper[0]);
		const targetRange = formatCodeGen.addText(mapCode);
		formatCodeGen.addMapping2({
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
		formatCodeGen.addText(formatWrapper[1]);
		formatCodeGen.addText(`\n;\n`);
	}
	function writeCode(mapCode: string, sourceRange: SourceMaps.Range, mode: SourceMaps.Mode, data: EmbeddedFileMappingData) {
		const targetRange = codeGen.addText(mapCode);
		codeGen.addMapping2({
			sourceRange,
			mappedRange: targetRange,
			mode,
			data,
		});
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

	if (tag === 'input' && type === 'radio')
		return undefined;

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

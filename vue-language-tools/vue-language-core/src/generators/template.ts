import { Segment } from '@volar/source-map';
import { PositionCapabilities } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize, hyphenate, isHTMLTag, isSVGTag } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { ResolvedVueCompilerOptions } from '../types';
import { colletVars, walkInterpolationFragment } from '../utils/transform';
import * as minimatch from 'minimatch';

const capabilitiesSet = {
	all: { hover: true, diagnostic: true, references: true, definition: true, rename: true, completion: true, semanticTokens: true } satisfies PositionCapabilities,
	noDiagnostic: { hover: true, references: true, definition: true, rename: true, completion: true, semanticTokens: true } satisfies PositionCapabilities,
	diagnosticOnly: { diagnostic: true } satisfies PositionCapabilities,
	tagHover: { hover: true } satisfies PositionCapabilities,
	event: { hover: true, diagnostic: true } satisfies PositionCapabilities,
	tagReference: { references: true, definition: true, rename: { normalize: undefined, apply: noEditApply } } satisfies PositionCapabilities,
	attr: { hover: true, diagnostic: true, references: true, definition: true, rename: true } satisfies PositionCapabilities,
	attrReference: { references: true, definition: true, rename: true } satisfies PositionCapabilities,
	scopedClassName: { references: true, definition: true, rename: true, completion: true } satisfies PositionCapabilities,
	slotName: { hover: true, diagnostic: true, references: true, definition: true, completion: true } satisfies PositionCapabilities,
	slotNameExport: { hover: true, diagnostic: true, references: true, definition: true, /* referencesCodeLens: true */ } satisfies PositionCapabilities,
	refAttr: { references: true, definition: true, rename: true } satisfies PositionCapabilities,
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

	const codeGen: Segment<PositionCapabilities>[] = [];
	const formatCodeGen: Segment<PositionCapabilities>[] = [];
	const cssCodeGen: Segment<PositionCapabilities>[] = [];
	const slots = new Map<string, {
		varName: string,
		loc: [number, number],
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

	formatCodeGen.push('export { };\n');

	const componentVars = writeComponentVars();

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

		codeGen.push(`declare var __VLS_slots:\n`);
		for (const [exp, slot] of slotExps) {
			codeGen.push(`Record<NonNullable<typeof ${exp}>, typeof ${slot.varName}> &\n`);
		}
		codeGen.push(`{\n`);
		for (const [name, slot] of slots) {
			slotsNum++;
			writeObjectProperty(
				name,
				slot.loc, // TODO: SourceMaps.MappingKind.Expand
				{
					...capabilitiesSet.slotNameExport,
					referencesCodeLens: hasScriptSetup,
				},
				slot.nodeLoc,
			);
			codeGen.push(`: (_: typeof ${slot.varName}) => any,\n`);
		}
		codeGen.push(`};\n`);
	}
	function writeStyleScopedClasses() {

		codeGen.push(`if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {\n`);
		for (const { className, offset } of scopedClasses) {
			codeGen.push(`__VLS_styleScopedClasses[`);
			writeCodeWithQuotes(
				className,
				offset,
				{
					...capabilitiesSet.scopedClassName,
					displayWithLink: cssScopedClassesSet.has(className),
				},
			);
			codeGen.push(`];\n`);
		}
		codeGen.push('}\n');
	}
	function writeComponentVars() {

		const data: Record<string, string> = {};

		for (const tagName in tagNames) {

			if (isIntrinsicElement(vueCompilerOptions.experimentalRuntimeMode, tagName))
				continue;

			const isNamespacedTag = tagName.indexOf('.') >= 0;
			if (isNamespacedTag)
				continue;

			const tagOffsets = tagNames[tagName];
			const tagRanges: [number, number][] = tagOffsets.map(offset => [offset, offset + tagName.length]);
			const var_componentVar = capitalize(camelize(tagName.replace(/:/g, '-')));

			const names = new Set([
				// order is important: https://github.com/johnsoncodehk/volar/issues/2010
				capitalize(camelize(tagName)),
				camelize(tagName),
				tagName,
			]);

			codeGen.push(`let ${var_componentVar}!: import('./__VLS_types.js').GetComponents<typeof __VLS_components, ${[...names].map(name => `'${name}'`).join(', ')}>;\n`);

			for (const name of names) {
				for (const tagRange of tagRanges) {
					codeGen.push('__VLS_components');
					writePropertyAccess(
						name,
						tagRange,
						{
							...capabilitiesSet.tagReference,
							rename: {
								normalize: tagName === name ? capabilitiesSet.tagReference.rename.normalize : unHyphenatComponentName,
								apply: getRenameApply(tagName),
							},
						},
					);
					codeGen.push(';');
				}
			}
			codeGen.push('\n');

			data[tagName] = var_componentVar;
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

			const startTagOffset = node.loc.start.offset + source.indexOf(node.tag);
			offsets.push(startTagOffset); // start tag
			if (!node.isSelfClosing && sourceLang === 'html') {
				const endTagOffset = node.loc.start.offset + node.loc.source.lastIndexOf(node.tag);
				if (endTagOffset !== startTagOffset) {
					offsets.push(endTagOffset); // end tag
				}
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
	function visitNode(node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode, parentEl: CompilerDOM.ElementNode | undefined): void {
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
				capabilitiesSet.all,
				'(',
				');\n',
				node.content.loc,
			);
			writeInterpolationVarsExtraCompletion();
			appendFormattingCode(
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
					codeGen.push('if');
				else if (branch.condition)
					codeGen.push('else if');
				else
					codeGen.push('else');

				let addedBlockCondition = false;

				if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					codeGen.push(` `);
					writeInterpolation(
						branch.condition.content,
						branch.condition.loc.start.offset,
						capabilitiesSet.all,
						'(',
						')',
						branch.condition.loc,
					);
					appendFormattingCode(
						branch.condition.content,
						branch.condition.loc.start.offset,
						formatBrackets.round,
					);

					if (vueCompilerOptions.narrowingTypesInInlineHandlers) {
						blockConditions.push(branch.condition.content);
						addedBlockCondition = true;
					}
				}

				codeGen.push(` {\n`);
				writeInterpolationVarsExtraCompletion();
				for (const childNode of branch.children) {
					visitNode(childNode, parentEl);
				}
				codeGen.push('}\n');

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

			codeGen.push(`for (const [`);
			if (leftExpressionRange && leftExpressionText) {

				const collentAst = createTsAst(node.parseResult, `const [${leftExpressionText}]`);
				colletVars(ts, collentAst, forBlockVars);

				for (const varName of forBlockVars)
					localVars[varName] = (localVars[varName] ?? 0) + 1;

				codeGen.push([leftExpressionText, 'template', leftExpressionRange.start, capabilitiesSet.all]);
				appendFormattingCode(leftExpressionText, leftExpressionRange.start, formatBrackets.square);
			}
			codeGen.push(`] of (await import('./__VLS_types.js')).getVforSourceType`);
			if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				writeInterpolation(
					source.content,
					source.loc.start.offset,
					capabilitiesSet.all,
					'(',
					')',
					source.loc,
				);
				appendFormattingCode(
					source.content,
					source.loc.start.offset,
					formatBrackets.empty,
				);

				codeGen.push(`) {\n`);

				writeInterpolationVarsExtraCompletion();

				for (const childNode of node.children) {
					visitNode(childNode, parentEl);
				}

				codeGen.push('}\n');
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
			codeGen.push(`// Unprocessed node type: ${node.type} json: ${JSON.stringify(node.loc)}\n`);
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

		codeGen.push(`{\n`);

		const startTagOffset = node.loc.start.offset + sourceTemplate.substring(node.loc.start.offset).indexOf(node.tag);
		let endTagOffset = !node.isSelfClosing && sourceLang === 'html' ? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) : undefined;

		if (endTagOffset === startTagOffset) {
			endTagOffset = undefined;
		}

		let _unwritedExps: CompilerDOM.SimpleExpressionNode[];

		const _isIntrinsicElement = isIntrinsicElement(vueCompilerOptions.experimentalRuntimeMode, node.tag);
		const _isNamespacedTag = node.tag.indexOf('.') >= 0;
		const tagText = componentVars[node.tag] ?? node.tag;

		if (vueCompilerOptions.jsxTemplates) {

			codeGen.push([
				'',
				'template',
				node.loc.start.offset,
				capabilitiesSet.diagnosticOnly,
			]);
			const tagCapabilities: PositionCapabilities = _isIntrinsicElement || _isNamespacedTag ? capabilitiesSet.all : {
				...capabilitiesSet.diagnosticOnly,
				...capabilitiesSet.tagHover,
			};

			codeGen.push(`<`);
			codeGen.push([
				tagText,
				'template',
				[startTagOffset, startTagOffset + node.tag.length],
				tagCapabilities,
			]);
			codeGen.push(` `);
			const { unwritedExps } = writeProps(node, 'jsx', 'props');
			_unwritedExps = unwritedExps;

			if (endTagOffset === undefined) {
				codeGen.push(`/>`);
			}
			else {
				codeGen.push(`></`);
				codeGen.push([
					tagText,
					'template',
					[endTagOffset, endTagOffset + node.tag.length],
					tagCapabilities,
				]);
				codeGen.push(`>;\n`);
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
			codeGen.push([
				'',
				'template',
				startTagEnd,
				capabilitiesSet.diagnosticOnly,
			]);
			codeGen.push(`\n`);
		}
		else {

			const var_props = `__VLS_${elementIndex++}`;

			if (_isIntrinsicElement) {
				codeGen.push(`let ${var_props} = ({} as JSX.IntrinsicElements)`);
				writePropertyAccess(
					node.tag,
					startTagOffset,
					{
						...capabilitiesSet.tagReference,
						...capabilitiesSet.tagHover,
					},
				);
				codeGen.push(`;\n`);

				if (endTagOffset !== undefined) {
					codeGen.push(`({} as JSX.IntrinsicElements)`);
					writePropertyAccess(
						node.tag,
						endTagOffset,
						{
							...capabilitiesSet.tagReference,
							...capabilitiesSet.tagHover,
						},
					);
					codeGen.push(`;\n`);
				}
			}
			else if (_isNamespacedTag) {

				codeGen.push(`let ${var_props}!: import('./__VLS_types.js').ComponentProps<typeof ${tagText}>;\n`);

				codeGen.push([
					tagText,
					'template',
					[startTagOffset, startTagOffset + node.tag.length],
					capabilitiesSet.all,
				]);
				codeGen.push(`;\n`);

				if (endTagOffset !== undefined) {
					codeGen.push([
						tagText,
						'template',
						[endTagOffset, endTagOffset + node.tag.length],
						capabilitiesSet.all,
					]);
					codeGen.push(`;\n`);
				}
			}
			else {

				codeGen.push(`let ${var_props}!: import('./__VLS_types.js').ComponentProps<typeof `);
				codeGen.push([
					tagText,
					'template',
					[startTagOffset, startTagOffset + node.tag.length],
					capabilitiesSet.tagHover,
				]);
				codeGen.push(`>;\n`);

				if (endTagOffset !== undefined) {
					codeGen.push([
						tagText,
						'template',
						[endTagOffset, endTagOffset + node.tag.length],
						capabilitiesSet.tagHover,
					]);
					codeGen.push(`;\n`);
				}
			}

			codeGen.push([
				var_props,
				'template',
				[startTagOffset, startTagOffset + node.tag.length],
				capabilitiesSet.diagnosticOnly,
			]);
			codeGen.push(` = { `);
			const { unwritedExps } = writeProps(node, 'class', 'props');
			_unwritedExps = unwritedExps;
			codeGen.push(` };\n`);
		}
		{

			// fix https://github.com/johnsoncodehk/volar/issues/1775
			for (const failedExp of _unwritedExps) {
				writeInterpolation(
					failedExp.loc.source,
					failedExp.loc.start.offset,
					capabilitiesSet.all,
					'(',
					')',
					failedExp.loc,
				);
				const fb = formatBrackets.round;
				if (fb) {
					appendFormattingCode(
						failedExp.loc.source,
						failedExp.loc.start.offset,
						fb,
					);
				}
				codeGen.push(';\n');
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

				codeGen.push(`const ${scopeVar} = `);
				codeGen.push([
					vScope.exp.loc.source,
					'template',
					vScope.exp.loc.start.offset,
					capabilitiesSet.all,
				]);
				codeGen.push(';\n');
				codeGen.push(`if (${condition}) {\n`);
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
				codeGen.push('}\n');
				blockConditions.length = originalConditionsNum;
			}
		}
		codeGen.push(`}\n`);
	}
	function writeEvents(node: CompilerDOM.ElementNode) {

		let _varComponentInstance: string | undefined;

		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {

				const varComponentInstance = tryWriteInstance();
				const componentVar = componentVars[node.tag];
				const varInstanceProps = `__VLS_${elementIndex++}`;
				const key_2 = camelize('on-' + prop.arg.loc.source); // onClickOutside

				codeGen.push(`type ${varInstanceProps} = `);
				if (!varComponentInstance) {
					codeGen.push(`JSX.IntrinsicElements['${node.tag}'];\n`);
				}
				else {
					codeGen.push(`import('./__VLS_types.js').InstanceProps<typeof ${varComponentInstance}, ${componentVar ? 'typeof ' + componentVar : '{}'}>;\n`);;
				}
				codeGen.push(`const __VLS_${elementIndex++}: import('./__VLS_types.js').EventObject<typeof ${varComponentInstance}, '${prop.arg.loc.source}', ${componentVar ? 'typeof ' + componentVar : '{}'}, `);

				codeGen.push(`${varInstanceProps}[`);
				writeCodeWithQuotes(
					key_2,
					[prop.arg.loc.start.offset, prop.arg.loc.end.offset],
					{
						...capabilitiesSet.attrReference,
						rename: {
							normalize(newName) {
								return camelize('on-' + newName);
							},
							apply(newName) {
								const hName = hyphenate(newName);
								if (hyphenate(newName).startsWith('on-')) {
									return camelize(hName.slice('on-'.length));
								}
								return newName;
							},
						},
					},
				);
				codeGen.push(`]> = {\n`);
				{
					writeObjectProperty(
						prop.arg.loc.source,
						prop.arg.loc.start.offset,
						capabilitiesSet.event,
						prop.arg.loc,
					);
					codeGen.push(`: `);
					appendExpressionNode(prop);
				}
				codeGen.push(`};\n`);
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
					capabilitiesSet.all,
					'$event => {(',
					')}',
					prop.exp.loc,
				);
				appendFormattingCode(
					prop.exp.content,
					prop.exp.loc.start.offset,
					formatBrackets.round,
				);
				codeGen.push(`;\n`);
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
						capabilitiesSet.all,
						prefix,
						suffix,
						prop.exp.loc,
					);
					appendFormattingCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						formatBrackets.round,
					);
				}
				else {
					codeGen.push(`() => {}`);
				}
			}
		}

		writeInterpolationVarsExtraCompletion();

		function tryWriteInstance() {

			if (!_varComponentInstance) {
				const componentVar = componentVars[node.tag];

				if (componentVar) {
					const _varComponentInstanceA = `__VLS_${elementIndex++}`;
					const _varComponentInstanceB = `__VLS_${elementIndex++}`;
					_varComponentInstance = `__VLS_${elementIndex++}`;
					codeGen.push(`const ${_varComponentInstanceA} = new ${componentVar}({ `);
					writeProps(node, 'class', 'slots');
					codeGen.push(`});\n`);
					codeGen.push(`const ${_varComponentInstanceB} = ${componentVar}({ `);
					writeProps(node, 'class', 'slots');
					codeGen.push(`});\n`);
					codeGen.push(`let ${_varComponentInstance}!: import('./__VLS_types.js').PickNotAny<typeof ${_varComponentInstanceA}, typeof ${_varComponentInstanceB}>;\n`);
				}
			}

			return _varComponentInstance;
		}
	}
	function writeProps(node: CompilerDOM.ElementNode, format: 'jsx' | 'class', mode: 'props' | 'slots') {

		let styleAttrNums = 0;
		let classAttrNums = 0;
		const unwritedExps: CompilerDOM.SimpleExpressionNode[] = [];

		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& (prop.name === 'bind' || prop.name === 'model')
				&& (prop.name === 'model' || prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
				&& (!prop.exp || prop.exp.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
			) {

				let attrNameText =
					prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
						? prop.arg.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY
							? prop.arg.content
							: prop.arg.loc.source
						: getModelValuePropName(node, vueCompilerOptions.target, vueCompilerOptions);

				if (prop.modifiers.some(m => m === 'prop' || m === 'attr')) {
					attrNameText = attrNameText?.substring(1);
				}

				if (
					attrNameText === undefined
					|| vueCompilerOptions.dataAttributes.some(pattern => minimatch(attrNameText!, pattern))
					|| (attrNameText === 'style' && ++styleAttrNums >= 2)
					|| (attrNameText === 'class' && ++classAttrNums >= 2)
				) {
					if (prop.exp && prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
						unwritedExps.push(prop.exp);
					}
					continue;
				}

				const isStatic = !prop.arg || (prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic);
				const propName = isStatic
					&& hyphenate(attrNameText) === attrNameText
					&& !vueCompilerOptions.htmlAttributes.some(pattern => minimatch(attrNameText!, pattern))
					? camelize(attrNameText)
					: attrNameText;

				if (vueCompilerOptions.strictTemplates) {
					attrNameText = propName;
				}

				// camelize name
				writePropStart(isStatic);
				codeGen.push([
					'',
					'template',
					prop.loc.start.offset,
					getCaps(capabilitiesSet.diagnosticOnly),
				]);
				if (!prop.arg) {
					writePropName(
						attrNameText,
						isStatic,
						[prop.loc.start.offset, prop.loc.start.offset + prop.loc.source.indexOf('=')],
						getCaps(capabilitiesSet.attr),
						(prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}),
					);
				}
				else if (prop.exp?.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
					writePropName(
						propName,
						isStatic,
						[prop.arg.loc.start.offset, prop.arg.loc.start.offset + attrNameText.length], // patch style attr,
						{
							...getCaps(capabilitiesSet.attr),
							rename: {
								normalize: camelize,
								apply: getRenameApply(attrNameText),
							},
						},
						(prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {}),
					);
				}
				else {
					writePropName(
						propName,
						isStatic,
						[prop.arg.loc.start.offset, prop.arg.loc.end.offset],
						{
							...getCaps(capabilitiesSet.attr),
							rename: {
								normalize: camelize,
								apply: getRenameApply(attrNameText),
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
						getCaps(capabilitiesSet.all),
						'(',
						')',
						prop.exp.loc,
					);
					const fb = getFormatBrackets(formatBrackets.round);
					if (fb) {
						appendFormattingCode(
							prop.exp.loc.source,
							prop.exp.loc.start.offset,
							fb,
						);
					}
				}
				else {
					codeGen.push('{}');
				}
				writePropValueSuffix(isStatic);
				codeGen.push([
					'',
					'template',
					prop.loc.end.offset,
					getCaps(capabilitiesSet.diagnosticOnly),
				]);
				writePropEnd(isStatic);
				// original name
				if (prop.arg && attrNameText !== propName) {
					writePropStart(isStatic);
					writePropName(
						attrNameText,
						isStatic,
						[prop.arg.loc.start.offset, prop.arg.loc.end.offset],
						{
							...getCaps(capabilitiesSet.attr),
							rename: {
								normalize: camelize,
								apply: getRenameApply(attrNameText),
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
						codeGen.push('undefined');
					}
					writePropValueSuffix(isStatic);
					writePropEnd(isStatic);
				}
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			) {

				let attrNameText = prop.name;

				if (
					vueCompilerOptions.dataAttributes.some(pattern => minimatch(attrNameText!, pattern))
					|| (attrNameText === 'style' && ++styleAttrNums >= 2)
					|| (attrNameText === 'class' && ++classAttrNums >= 2)
				) {
					continue;
				}

				const propName = hyphenate(prop.name) === prop.name
					&& !vueCompilerOptions.htmlAttributes.some(pattern => minimatch(attrNameText, pattern))
					? camelize(prop.name)
					: prop.name;

				if (vueCompilerOptions.strictTemplates) {
					attrNameText = propName;
				}

				// camelize name
				writePropStart(true);
				codeGen.push([
					'',
					'template',
					prop.loc.start.offset,
					getCaps(capabilitiesSet.diagnosticOnly),
				]);
				writePropName(
					propName,
					true,
					[prop.loc.start.offset, prop.loc.start.offset + attrNameText.length],
					{
						...getCaps(capabilitiesSet.attr),
						rename: {
							normalize: camelize,
							apply: getRenameApply(prop.name),
						},
					},
					(prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}),
				);
				writePropValuePrefix(true);
				if (prop.value) {
					writeAttrValue(prop.value);
				}
				else {
					codeGen.push('true');
				}
				writePropValueSuffix(true);
				writePropEnd(true);
				codeGen.push([
					'',
					'template',
					prop.loc.end.offset,
					getCaps(capabilitiesSet.diagnosticOnly),
				]);
				// original name
				if (attrNameText !== propName) {
					writePropStart(true);
					writePropName(
						attrNameText,
						true,
						prop.loc.start.offset,
						{
							...getCaps(capabilitiesSet.attr),
							rename: {
								normalize: camelize,
								apply: getRenameApply(prop.name),
							},
						},
						(prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {}),
					);
					writePropValuePrefix(true);
					if (prop.value) {
						writeAttrValue(prop.value);
					}
					else {
						codeGen.push('true');
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
				if (format === 'jsx')
					codeGen.push('{...');
				else
					codeGen.push('...');
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					getCaps(capabilitiesSet.all),
					'(',
					')',
					prop.exp.loc,
				);
				const fb = getFormatBrackets(formatBrackets.round);
				if (fb) {
					appendFormattingCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						fb,
					);
				}
				if (format === 'jsx')
					codeGen.push('} ');
				else
					codeGen.push(', ');
			}
			else {
				// comment this line to avoid affecting comments in prop expressions
				// tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */ ");
			}
		}

		return { unwritedExps };

		function writePropName(name: string, isStatic: boolean, sourceRange: number | [number, number], data: PositionCapabilities, cacheOn: any) {
			if (format === 'jsx' && isStatic) {
				codeGen.push([
					name,
					'template',
					sourceRange,
					data,
				]);
			}
			else {
				writeObjectProperty(
					name,
					sourceRange,
					data,
					cacheOn,
				);
			}
		}
		function writePropValuePrefix(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codeGen.push('={');
			}
			else {
				codeGen.push(': (');
			}
		}
		function writePropValueSuffix(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codeGen.push('}');
			}
			else {
				codeGen.push(')');
			}
		}
		function writePropStart(isStatic: boolean) {
			if (format === 'jsx' && !isStatic) {
				codeGen.push('{...{');
			}
		}
		function writePropEnd(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codeGen.push(' ');
			}
			else if (format === 'jsx' && !isStatic) {
				codeGen.push('}} ');
			}
			else {
				codeGen.push(', ');
			}
		}
		function getCaps(caps: PositionCapabilities): PositionCapabilities {
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
			codeGen.push('"');
			let start = attrNode.loc.start.offset;
			let end = attrNode.loc.end.offset;
			if (end - start > attrNode.content.length) {
				start++;
				end--;
			}
			codeGen.push([
				toUnicodeIfNeed(attrNode.content),
				'template',
				[start, end],
				getCaps(capabilitiesSet.all),
			]);
			codeGen.push('"');
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

				cssCodeGen.push(`${node.tag} { `);
				cssCodeGen.push([
					content,
					'template',
					prop.arg.loc.start.offset + start,
					{
						hover: true,
						references: true,
						definition: true,
						diagnostic: true,
						rename: true,
						completion: true,
						semanticTokens: true,
					},
				]);
				cssCodeGen.push(` }\n`);
			}
		}
	}
	function writeImportSlots(node: CompilerDOM.ElementNode, parentEl: CompilerDOM.ElementNode | undefined, slotBlockVars: string[]) {

		const componentVar = parentEl ? componentVars[parentEl.tag] : undefined;

		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'slot'
			) {

				const varComponentInstanceA = `__VLS_${elementIndex++}`;
				const varComponentInstanceB = `__VLS_${elementIndex++}`;
				const varSlots = `__VLS_${elementIndex++}`;

				if (componentVar && parentEl) {
					codeGen.push(`const ${varComponentInstanceA} = new ${componentVar}({ `);
					writeProps(parentEl, 'class', 'slots');
					codeGen.push(`});\n`);
					codeGen.push(`const ${varComponentInstanceB} = ${componentVar}({ `);
					writeProps(parentEl, 'class', 'slots');
					codeGen.push(`});\n`);
					writeInterpolationVarsExtraCompletion();
					codeGen.push(`let ${varSlots}!: import('./__VLS_types.js').ExtractComponentSlots<import('./__VLS_types.js').PickNotAny<typeof ${varComponentInstanceA}, typeof ${varComponentInstanceB}>>;\n`);
				}

				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					codeGen.push(`const `);

					const collentAst = createTsAst(prop, `const ${prop.exp.content}`);
					colletVars(ts, collentAst, slotBlockVars);

					codeGen.push([
						prop.exp.content,
						'template',
						prop.exp.loc.start.offset,
						capabilitiesSet.all,
					]);
					appendFormattingCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						formatBrackets.round,
					);

					codeGen.push(` = `);
				}

				if (!componentVar || !parentEl) {
					// fix https://github.com/johnsoncodehk/volar/issues/1425
					codeGen.push(`{} as any;\n`);
					continue;
				}

				let slotName = 'default';
				let isStatic = true;
				if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.content !== '') {
					isStatic = prop.arg.isStatic;
					slotName = prop.arg.content;
				}
				const argRange: [number, number] = prop.arg
					? [prop.arg.loc.start.offset, prop.arg.loc.end.offset]
					: [prop.loc.start.offset, prop.loc.start.offset + prop.loc.source.split('=')[0].length];
				codeGen.push([
					'',
					'template',
					argRange[0],
					capabilitiesSet.diagnosticOnly,
				]);
				codeGen.push(varSlots);
				if (isStatic) {
					writePropertyAccess(
						slotName,
						argRange,
						{
							...capabilitiesSet.slotName,
							completion: !!prop.arg,
						},
						false,
					);
				}
				else {
					codeGen.push(`[`);
					writeInterpolation(
						slotName,
						argRange[0] + 1,
						capabilitiesSet.all,
						'',
						'',
						(prop.loc as any).slot_name ?? ((prop.loc as any).slot_name = {}),
					);
					codeGen.push(`]`);
					writeInterpolationVarsExtraCompletion();
				}
				codeGen.push([
					'',
					'template',
					argRange[1],
					capabilitiesSet.diagnosticOnly,
				]);
				codeGen.push(`;\n`);

				if (isStatic && !prop.arg) {

					let offset = prop.loc.start.offset;

					if (prop.loc.source.startsWith('#'))
						offset += '#'.length;
					else if (prop.loc.source.startsWith('v-slot:'))
						offset += 'v-slot:'.length;

					codeGen.push(varSlots);
					codeGen.push(`['`);
					codeGen.push([
						'',
						'template',
						offset,
						{ completion: true },
					]);
					codeGen.push(`'];\n`);
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

				codeGen.push([
					'',
					'template',
					prop.loc.start.offset,
					capabilitiesSet.diagnosticOnly,
				]);
				codeGen.push(`(await import('./__VLS_types.js')).directiveFunction(__VLS_ctx.`);
				codeGen.push([
					camelize('v-' + prop.name),
					'template',
					[prop.loc.start.offset, prop.loc.start.offset + 'v-'.length + prop.name.length],
					{
						...capabilitiesSet.noDiagnostic,
						completion: {
							// fix https://github.com/johnsoncodehk/volar/issues/1905
							additional: true,
						},
						rename: {
							normalize: camelize,
							apply: getRenameApply(prop.name),
						},
					},
				]);
				identifiers.add(camelize('v-' + prop.name));
				codeGen.push(`)(`);
				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					writeInterpolation(
						prop.exp.content,
						prop.exp.loc.start.offset,
						capabilitiesSet.all,
						'(',
						')',
						prop.exp.loc,
					);
					appendFormattingCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						formatBrackets.round,
					);
				}
				codeGen.push(`)`);
				codeGen.push([
					'',
					'template',
					prop.loc.end.offset,
					capabilitiesSet.diagnosticOnly,
				]);
				codeGen.push(`;\n`);
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
				codeGen.push(`// @ts-ignore\n`);
				writeInterpolation(
					prop.value.content,
					prop.value.loc.start.offset + 1,
					capabilitiesSet.refAttr,
					'(',
					')',
					prop.value.loc,
				);
				codeGen.push(`;\n`);
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
				codeGen.push(`__VLS_styleScopedClasses = (`);
				codeGen.push([
					prop.exp.content,
					'template',
					prop.exp.loc.start.offset,
					capabilitiesSet.scopedClassName,
				]);
				codeGen.push(`);\n`);
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
				codeGen.push(`const ${varDefaultBind} = `);
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					capabilitiesSet.attrReference,
					'(',
					')',
					prop.exp.loc,
				);
				codeGen.push(`;\n`);
				writeInterpolationVarsExtraCompletion();
				break;
			}
		}

		codeGen.push(`const ${varBinds} = {\n`);
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content !== 'name'
			) {
				writeObjectProperty(
					prop.arg.content,
					[prop.arg.loc.start.offset, prop.arg.loc.end.offset],
					{
						...capabilitiesSet.attrReference,
						rename: {
							normalize: camelize,
							apply: getRenameApply(prop.arg.content),
						},
					},
					prop.arg.loc,
				);
				codeGen.push(`: `);
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					capabilitiesSet.attrReference,
					'(',
					')',
					prop.exp.loc,
				);
				codeGen.push(`,\n`);
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				&& prop.name !== 'name' // slot name
			) {
				const propValue = prop.value !== undefined ? `"${toUnicodeIfNeed(prop.value.content)}"` : 'true';
				writeObjectProperty(
					prop.name,
					prop.loc.start.offset,
					{
						...capabilitiesSet.attr,
						rename: {
							normalize: camelize,
							apply: getRenameApply(prop.name),
						},
					},
					prop.loc,
				);
				codeGen.push(`: (`);
				codeGen.push(propValue);
				codeGen.push(`),\n`);
			}
		}
		codeGen.push(`};\n`);

		writeInterpolationVarsExtraCompletion();

		if (hasDefaultBind) {
			codeGen.push(`var ${varSlot}!: typeof ${varDefaultBind} & typeof ${varBinds};\n`);
		}
		else {
			codeGen.push(`var ${varSlot}!: typeof ${varBinds};\n`);
		}

		if (slotNameExp) {
			const varSlotExp = `__VLS_${elementIndex++}`;
			const varSlotExp2 = `__VLS_${elementIndex++}`;
			codeGen.push(`const ${varSlotExp} = ${slotNameExp};\n`);
			codeGen.push(`var ${varSlotExp2}!: typeof ${varSlotExp};\n`);
			slotExps.set(varSlotExp2, {
				varName: varSlot,
			});
		}
		else {
			slots.set(slotName, {
				varName: varSlot,
				loc: [startTagOffset, startTagOffset + node.tag.length],
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
	function writeObjectProperty(mapCode: string, sourceRange: number | [number, number], data: PositionCapabilities, cacheOn: any) {
		if (validTsVar.test(mapCode)) {
			codeGen.push([mapCode, 'template', sourceRange, data]);
			return 1;
		}
		else if (mapCode.startsWith('[') && mapCode.endsWith(']')) {
			writeInterpolation(
				mapCode,
				typeof sourceRange === 'number' ? sourceRange : sourceRange[0],
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
	function writePropertyAccess(mapCode: string, sourceRange: number | [number, number], data: PositionCapabilities, checkValid = true) {
		if (checkValid && validTsVar.test(mapCode)) {
			codeGen.push(`.`);
			codeGen.push([mapCode, 'template', sourceRange, data]);
		}
		else if (mapCode.startsWith('[') && mapCode.endsWith(']')) {
			codeGen.push([mapCode, 'template', sourceRange, data]);
		}
		else {
			codeGen.push(`[`);
			writeCodeWithQuotes(mapCode, sourceRange, data);
			codeGen.push(`]`);
		}
	}
	function writeCodeWithQuotes(mapCode: string, sourceRange: number | [number, number], data: PositionCapabilities) {
		codeGen.push([
			'',
			'template',
			typeof sourceRange === 'number' ? sourceRange : sourceRange[0],
			data,
		]);
		codeGen.push(`'`);
		codeGen.push([mapCode, 'template', sourceRange, data]);
		codeGen.push(`'`);
		codeGen.push([
			'',
			'template',
			typeof sourceRange === 'number' ? sourceRange : sourceRange[1],
			data,
		]);
	}
	function writeInterpolation(
		mapCode: string,
		sourceOffset: number | undefined,
		data: PositionCapabilities | undefined,
		prefix: string,
		suffix: string,
		cacheOn: any,
	) {
		const ast = createTsAst(cacheOn, prefix + mapCode + suffix);
		const vars = walkInterpolationFragment(ts, prefix + mapCode + suffix, ast, (frag, fragOffset, isJustForErrorMapping) => {
			if (fragOffset === undefined) {
				codeGen.push(frag);
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
					codeGen.push(frag.substring(0, -fragOffset));
					frag = frag.substring(-fragOffset);
					fragOffset = 0;
				}
				if (sourceOffset !== undefined && data !== undefined) {
					codeGen.push([
						frag,
						'template',
						sourceOffset + fragOffset,
						isJustForErrorMapping
							? capabilitiesSet.diagnosticOnly
							: data,
					]);
				}
				else {
					codeGen.push(frag);
				}
				codeGen.push(addSubfix);
			}
		}, localVars, identifiers, vueCompilerOptions);
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

		codeGen.push('[');
		for (const _vars of tempVars) {
			for (const v of _vars) {
				codeGen.push([v.text, 'template', v.offset, { completion: { additional: true } }]);
				codeGen.push(',');
			}
		}
		codeGen.push('];\n');
		tempVars.length = 0;
	}
	function appendFormattingCode(mapCode: string, sourceOffset: number, formatWrapper: [string, string]) {
		formatCodeGen.push(formatWrapper[0]);
		formatCodeGen.push([mapCode, 'template', sourceOffset, {}]);
		formatCodeGen.push(formatWrapper[1]);
		formatCodeGen.push(`\n;\n`);
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

function toUnicodeIfNeed(str: string) {
	if (str.indexOf('\\') === -1 && str.indexOf('\n') === -1) {
		return str;
	}
	return toUnicode(str);
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
function getRenameApply(oldName: string) {
	return oldName === hyphenate(oldName) ? hyphenate : noEditApply;
}
function noEditApply(n: string) {
	return n;
}
function getModelValuePropName(node: CompilerDOM.ElementNode, vueVersion: number, vueCompilerOptions: ResolvedVueCompilerOptions) {

	for (const modelName in vueCompilerOptions.experimentalModelPropName) {
		const tags = vueCompilerOptions.experimentalModelPropName[modelName];
		for (const tag in tags) {
			if (node.tag === tag || node.tag === hyphenate(tag)) {
				const v = tags[tag];
				if (typeof v === 'object') {
					const arr = Array.isArray(v) ? v : [v];
					for (const attrs of arr) {
						let failed = false;
						for (const attr in attrs) {
							const attrNode = node.props.find(prop => prop.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop.name === attr) as CompilerDOM.AttributeNode | undefined;
							if (!attrNode || attrNode.value?.content !== attrs[attr]) {
								failed = true;
								break;
							}
						}
						if (!failed) {
							// all match
							return modelName || undefined;
						}
					}
				}
			}
		}
	}

	for (const modelName in vueCompilerOptions.experimentalModelPropName) {
		const tags = vueCompilerOptions.experimentalModelPropName[modelName];
		for (const tag in tags) {
			if (node.tag === tag || node.tag === hyphenate(tag)) {
				const attrs = tags[tag];
				if (attrs === true) {
					return modelName || undefined;
				}
			}
		}
	}

	return vueVersion < 3 ? 'value' : 'modelValue';
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
		CompilerDOM.processFor(node, forDirective, transformContext, _forNode => {
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

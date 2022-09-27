import { CodeGen } from '@volar/code-gen';
import { PositionCapabilities } from '@volar/language-core';
import * as SourceMaps from '@volar/source-map';
import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize, hyphenate, isHTMLTag, isSVGTag } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { parseBindingRanges } from '../parsers/scriptSetupRanges';
import { EmbeddedFileMappingData } from '../sourceFile';
import { ResolvedVueCompilerOptions } from '../types';
import { colletVars, walkInterpolationFragment } from '../utils/transform';

const capabilitiesSet = {
	all: { hover: true, diagnostic: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true } satisfies PositionCapabilities,
	noDiagnostic: { hover: true, references: true, definitions: true, rename: true, completion: true, semanticTokens: true } satisfies PositionCapabilities,
	diagnosticOnly: { diagnostic: true } satisfies PositionCapabilities,
	tagHover: { hover: true } satisfies PositionCapabilities,
	event: { hover: true, diagnostic: true } satisfies PositionCapabilities,
	tagReference: { references: true, definitions: true, rename: { normalize: undefined, apply: (_: string, newName: string) => newName } } satisfies PositionCapabilities,
	attr: { hover: true, diagnostic: true, references: true, definitions: true, rename: true } satisfies PositionCapabilities,
	attrReference: { references: true, definitions: true, rename: true } satisfies PositionCapabilities,
	scopedClassName: { references: true, definitions: true, rename: true, completion: true } satisfies PositionCapabilities,
	slotName: { hover: true, diagnostic: true, references: true, definitions: true, completion: true } satisfies PositionCapabilities,
	slotNameExport: { hover: true, diagnostic: true, references: true, definitions: true, /* referencesCodeLens: true */ } satisfies PositionCapabilities,
	refAttr: { references: true, definitions: true, rename: true } satisfies PositionCapabilities,
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
		loc: SourceMaps.MappingRange,
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

	formatCodeGen.append('export { };\n');

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

		codeGen.append(`declare var __VLS_slots:\n`);
		for (const [exp, slot] of slotExps) {
			codeGen.append(`Record<NonNullable<typeof ${exp}>, typeof ${slot.varName}> &\n`);
		}
		codeGen.append(`{\n`);
		for (const [name, slot] of slots) {
			slotsNum++;
			writeObjectProperty(
				name,
				slot.loc,
				SourceMaps.MappingKind.Expand,
				{
					vueTag: 'template',
					capabilities: {
						...capabilitiesSet.slotNameExport,
						referencesCodeLens: hasScriptSetup,
					},
				},
				slot.nodeLoc,
			);
			codeGen.append(`: (_: typeof ${slot.varName}) => any,\n`);
		}
		codeGen.append(`};\n`);
	}
	function writeStyleScopedClasses() {

		codeGen.append(`if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {\n`);
		for (const { className, offset } of scopedClasses) {
			codeGen.append(`__VLS_styleScopedClasses[`);
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
			codeGen.append(`];\n`);
		}
		codeGen.append('}\n');
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
			const tagRanges = tagOffsets.map(offset => ({ start: offset, end: offset + tagName.length }));
			const var_componentVar = capitalize(camelize(tagName.replace(/:/g, '-')));

			const names = new Set([
				tagName,
				camelize(tagName),
				capitalize(camelize(tagName)),
			]);

			codeGen.append(`let ${var_componentVar}!: `);

			if (vueCompilerOptions.jsxTemplates && !vueCompilerOptions.strictTemplates)
				codeGen.append(`import('./__VLS_types.js').ConvertInvalidJsxElement<`);

			codeGen.append(`import('./__VLS_types.js').GetComponents<typeof __VLS_components, ${[...names].map(name => `'${name}'`).join(', ')}>`);

			if (vueCompilerOptions.jsxTemplates && !vueCompilerOptions.strictTemplates)
				codeGen.append(`>`);

			codeGen.append(`;\n`);

			for (const name of names) {
				codeGen.append('__VLS_components');
				writePropertyAccess2(
					name,
					tagRanges,
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
				codeGen.append(';');
			}
			codeGen.append('\n');

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
					codeGen.append('if');
				else if (branch.condition)
					codeGen.append('else if');
				else
					codeGen.append('else');

				let addedBlockCondition = false;

				if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					codeGen.append(` `);
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

				codeGen.append(` {\n`);
				writeInterpolationVarsExtraCompletion();
				for (const childNode of branch.children) {
					visitNode(childNode, parentEl);
				}
				codeGen.append('}\n');

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

			codeGen.append(`for (const [`);
			if (leftExpressionRange && leftExpressionText) {

				const collentAst = createTsAst(node.parseResult, `const [${leftExpressionText}]`);
				colletVars(ts, collentAst, forBlockVars);

				for (const varName of forBlockVars)
					localVars[varName] = (localVars[varName] ?? 0) + 1;

				writeCode(
					leftExpressionText,
					leftExpressionRange,
					SourceMaps.MappingKind.Offset,
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
			codeGen.append(`] of (await import('./__VLS_types.js')).getVforSourceType`);
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

				codeGen.append(`) {\n`);

				writeInterpolationVarsExtraCompletion();

				for (const childNode of node.children) {
					visitNode(childNode, parentEl);
				}

				codeGen.append('}\n');
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
			codeGen.append(`// Unprocessed node type: ${node.type} json: ${JSON.stringify(node.loc)}\n`);
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
				SourceMaps.MappingKind.Offset,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.all,
				},
			);
			return;
		}

		codeGen.append(`{\n`);

		const startTagOffset = node.loc.start.offset + sourceTemplate.substring(node.loc.start.offset).indexOf(node.tag);
		const endTagOffset = !node.isSelfClosing && sourceLang === 'html' ? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) : undefined;

		let _unwritedExps: CompilerDOM.SimpleExpressionNode[];

		const _isIntrinsicElement = isIntrinsicElement(vueCompilerOptions.experimentalRuntimeMode, node.tag);
		const _isNamespacedTag = node.tag.indexOf('.') >= 0;
		const tagText = componentVars[node.tag] ?? node.tag;

		if (vueCompilerOptions.jsxTemplates) {

			const fullTagStart = codeGen.text.length;
			const tagCapabilities: PositionCapabilities = _isIntrinsicElement || _isNamespacedTag ? capabilitiesSet.all : capabilitiesSet.diagnosticOnly;

			codeGen.append(`<`);
			writeCode(
				tagText,
				{
					start: startTagOffset,
					end: startTagOffset + node.tag.length,
				},
				SourceMaps.MappingKind.Offset,
				{
					vueTag: 'template',
					capabilities: tagCapabilities,
				},
			);
			codeGen.append(` `);
			const { hasRemainStyleOrClass, unwritedExps } = writeProps(node, false, 'jsx', 'props');
			_unwritedExps = unwritedExps;

			if (endTagOffset === undefined) {
				codeGen.append(`/>`);
			}
			else {
				codeGen.append(`></`);
				writeCode(
					tagText,
					{
						start: endTagOffset,
						end: endTagOffset + node.tag.length,
					},
					SourceMaps.MappingKind.Offset,
					{
						vueTag: 'template',
						capabilities: tagCapabilities,
					},
				);
				codeGen.append(`>;\n`);
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
			codeGen.mappings.push({
				sourceRange: {
					start: node.loc.start.offset,
					end: startTagEnd,
				},
				mappedRange: {
					start: fullTagStart,
					end: codeGen.text.length,
				},
				kind: SourceMaps.MappingKind.Totally,
				data: {
					vueTag: 'template',
					capabilities: capabilitiesSet.diagnosticOnly,
				},
			});
			codeGen.append(`\n`);

			if (hasRemainStyleOrClass) {
				codeGen.append(`<${tagText} `);
				writeProps(node, true, 'jsx', 'props');
				codeGen.append(`/>\n`);
			}
		}
		else {

			const var_props = `__VLS_${elementIndex++}`;

			if (_isIntrinsicElement) {
				codeGen.append(`let ${var_props} = ({} as JSX.IntrinsicElements)`);
				writePropertyAccess(
					node.tag,
					{
						start: startTagOffset,
						end: startTagOffset + node.tag.length,
					},
					{
						vueTag: 'template',
						capabilities: {
							...capabilitiesSet.tagReference,
							...capabilitiesSet.tagHover,
						},
					},
				);
				codeGen.append(`;\n`);

				if (endTagOffset !== undefined) {
					codeGen.append(`({} as JSX.IntrinsicElements)`);
					writePropertyAccess(
						node.tag,
						{
							start: endTagOffset,
							end: endTagOffset + node.tag.length,
						},
						{
							vueTag: 'template',
							capabilities: {
								...capabilitiesSet.tagReference,
								...capabilitiesSet.tagHover,
							},
						},
					);
					codeGen.append(`;\n`);
				}
			}
			else if (_isNamespacedTag) {

				codeGen.append(`let ${var_props}!: import('./__VLS_types.js').ComponentProps<typeof ${tagText}>;\n`);

				writeCode(
					tagText,
					{
						start: startTagOffset,
						end: startTagOffset + node.tag.length,
					},
					SourceMaps.MappingKind.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
				);
				codeGen.append(`;\n`);

				if (endTagOffset !== undefined) {
					writeCode(
						tagText,
						{
							start: endTagOffset,
							end: endTagOffset + node.tag.length,
						},
						SourceMaps.MappingKind.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.all,
						},
					);
					codeGen.append(`;\n`);
				}
			}
			else {

				codeGen.append(`let ${var_props}!: import('./__VLS_types.js').ComponentProps<typeof `);
				writeCode(
					tagText,
					{
						start: startTagOffset,
						end: startTagOffset + node.tag.length,
					},
					SourceMaps.MappingKind.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.tagHover,
					},
				);
				codeGen.append(`>;\n`);

				if (endTagOffset !== undefined) {
					writeCode(
						tagText,
						{
							start: endTagOffset,
							end: endTagOffset + node.tag.length,
						},
						SourceMaps.MappingKind.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.tagHover,
						},
					);
					codeGen.append(`;\n`);
				}
			}

			writeCode(
				var_props,
				{
					start: startTagOffset,
					end: startTagOffset + node.tag.length,
				},
				SourceMaps.MappingKind.Offset,
				{
					vueTag: 'template',
					capabilities: capabilitiesSet.diagnosticOnly,
				},
			);
			codeGen.append(` = { `);
			const { hasRemainStyleOrClass, unwritedExps } = writeProps(node, false, 'class', 'props');
			_unwritedExps = unwritedExps;
			codeGen.append(` };\n`);

			if (hasRemainStyleOrClass) {
				codeGen.append(`${var_props} = { `);
				writeProps(node, true, 'class', 'props');
				codeGen.append(` };\n`);
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
				codeGen.append(';\n');
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

				codeGen.append(`const ${scopeVar} = `);
				writeCode(
					vScope.exp.loc.source,
					{
						start: vScope.exp.loc.start.offset,
						end: vScope.exp.loc.end.offset,
					},
					SourceMaps.MappingKind.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.all,
					},
				);
				codeGen.append(';\n');
				codeGen.append(`if (${condition}) {\n`);
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
				codeGen.append('}\n');
				blockConditions.length = originalConditionsNum;
			}
		}
		codeGen.append(`}\n`);
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

				const componentVar = componentVars[node.tag];
				const varInstanceProps = `__VLS_${elementIndex++}`;
				const key_2 = camelize('on-' + prop.arg.loc.source); // onClickOutside

				codeGen.append(`type ${varInstanceProps} = import('./__VLS_types.js').InstanceProps<typeof ${varComponentInstance}, ${componentVar ? 'typeof ' + componentVar : '{}'}>;\n`);
				codeGen.append(`const __VLS_${elementIndex++}: import('./__VLS_types.js').EventObject<typeof ${varComponentInstance}, '${prop.arg.loc.source}', ${componentVar ? 'typeof ' + componentVar : '{}'}, `);

				codeGen.append(`${varInstanceProps}[`);
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
				codeGen.append(`], import('./__VLS_types.js').GlobalAttrs[`);
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
				codeGen.append(`]> = {\n`);
				{
					writeObjectProperty(
						prop.arg.loc.source,
						{
							start: prop.arg.loc.start.offset,
							end: prop.arg.loc.end.offset,
						},
						SourceMaps.MappingKind.Offset,
						{
							vueTag: 'template',
							capabilities: capabilitiesSet.event,
						},
						prop.arg.loc,
					);
					codeGen.append(`: `);
					appendExpressionNode(prop);
				}
				codeGen.append(`};\n`);
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
				codeGen.append(`;\n`);
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
					codeGen.append(`() => {}`);
				}
			}
		}

		writeInterpolationVarsExtraCompletion();

		function tryWriteInstance() {

			if (writedInstance)
				return;

			const componentVar = componentVars[node.tag];

			if (componentVar) {
				codeGen.append(`const ${varComponentInstance} = new ${componentVar}({ `);
				writeProps(node, false, 'class', 'slots');
				codeGen.append(`});\n`);
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
				const diagStart = codeGen.text.length;
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
					codeGen.append('{}');
				}
				writePropValueSuffix(isStatic);
				codeGen.mappings.push({
					sourceRange: {
						start: prop.loc.start.offset,
						end: prop.loc.end.offset,
					},
					mappedRange: {
						start: diagStart,
						end: codeGen.text.length,
					},
					kind: SourceMaps.MappingKind.Totally,
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
						codeGen.append('undefined');
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
				const diagStart = codeGen.text.length;
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
					codeGen.append('true');
				}
				writePropValueSuffix(true);
				writePropEnd(true);
				const diagEnd = codeGen.text.length;
				codeGen.mappings.push({
					sourceRange: {
						start: prop.loc.start.offset,
						end: prop.loc.end.offset,
					},
					mappedRange: {
						start: diagStart,
						end: diagEnd,
					},
					kind: SourceMaps.MappingKind.Totally,
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
						codeGen.append('true');
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
					codeGen.append('{...');
				else
					codeGen.append('...');
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
					codeGen.append('} ');
				else
					codeGen.append(', ');
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

		function writePropName(name: string, isStatic: boolean, sourceRange: SourceMaps.MappingRange, data: EmbeddedFileMappingData, cacheOn: any) {
			if (format === 'jsx' && isStatic) {
				writeCode(
					name,
					sourceRange,
					SourceMaps.MappingKind.Offset,
					data,
				);
			}
			else {
				writeObjectProperty(
					name,
					sourceRange,
					SourceMaps.MappingKind.Offset,
					data,
					cacheOn,
				);
			}
		}
		function writePropValuePrefix(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codeGen.append('={');
			}
			else {
				codeGen.append(': (');
			}
		}
		function writePropValueSuffix(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codeGen.append('}');
			}
			else {
				codeGen.append(')');
			}
		}
		function writePropStart(isStatic: boolean) {
			if (format === 'jsx' && !isStatic) {
				codeGen.append('{...{');
			}
		}
		function writePropEnd(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codeGen.append(' ');
			}
			else if (format === 'jsx' && !isStatic) {
				codeGen.append('}} ');
			}
			else {
				codeGen.append(', ');
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
			codeGen.append('"');
			let start = attrNode.loc.start.offset;
			let end = attrNode.loc.end.offset;
			if (end - start > attrNode.content.length) {
				start++;
				end--;
			}
			writeCode(
				toUnicode(attrNode.content),
				{ start, end },
				SourceMaps.MappingKind.Offset,
				{
					vueTag: 'template',
					capabilities: getCaps(capabilitiesSet.all)
				},
			);
			codeGen.append('"');
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

				cssCodeGen.append(`${node.tag} { `);
				cssCodeGen.append(
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
				cssCodeGen.append(` }\n`);
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

				const varComponentInstance = `__VLS_${elementIndex++}`;
				const varSlots = `__VLS_${elementIndex++}`;

				if (componentVar && parentEl) {
					codeGen.append(`const ${varComponentInstance} = new ${componentVar}({ `);
					writeProps(parentEl, false, 'class', 'slots');
					codeGen.append(`});\n`);
					writeInterpolationVarsExtraCompletion();
					codeGen.append(`let ${varSlots}!: import('./__VLS_types.js').ExtractComponentSlots<typeof ${varComponentInstance}>;\n`);
				}

				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					codeGen.append(`const `);

					const collentAst = createTsAst(prop, `const ${prop.exp.content}`);
					colletVars(ts, collentAst, slotBlockVars);

					writeCode(
						prop.exp.content,
						{
							start: prop.exp.loc.start.offset,
							end: prop.exp.loc.end.offset,
						},
						SourceMaps.MappingKind.Offset,
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

					codeGen.append(` = `);
				}

				if (!componentVar || !parentEl) {
					// fix https://github.com/johnsoncodehk/volar/issues/1425
					codeGen.append(`{} as any;\n`);
					continue;
				}

				let slotName = 'default';
				let isStatic = true;
				if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.content !== '') {
					isStatic = prop.arg.isStatic;
					slotName = prop.arg.content;
				}
				const diagStart = codeGen.text.length;
				codeGen.append(varSlots);
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
					codeGen.append(`[`);
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
					codeGen.append(`]`);
					writeInterpolationVarsExtraCompletion();
				}
				const diagEnd = codeGen.text.length;
				codeGen.mappings.push({
					mappedRange: {
						start: diagStart,
						end: diagEnd,
					},
					sourceRange: argRange,
					kind: SourceMaps.MappingKind.Totally,
					data: {
						vueTag: 'template',
						capabilities: capabilitiesSet.diagnosticOnly,
					},
				});
				codeGen.append(`;\n`);

				if (isStatic && !prop.arg) {

					let offset = prop.loc.start.offset;

					if (prop.loc.source.startsWith('#'))
						offset += '#'.length;
					else if (prop.loc.source.startsWith('v-slot:'))
						offset += 'v-slot:'.length;

					codeGen.append(varSlots);
					codeGen.append(`['`);
					writeCode(
						'',
						{ start: offset, end: offset },
						SourceMaps.MappingKind.Offset,
						{
							vueTag: 'template',
							capabilities: {
								completion: true,
							},
						},
					);
					codeGen.append(`'];\n`);
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

				const diagStart = codeGen.text.length;
				codeGen.append(`(await import('./__VLS_types.js')).directiveFunction(__VLS_ctx.`);
				writeCode(
					camelize('v-' + prop.name),
					{
						start: prop.loc.start.offset,
						end: prop.loc.start.offset + 'v-'.length + prop.name.length,
					},
					SourceMaps.MappingKind.Offset,
					{
						vueTag: 'template',
						capabilities: {
							...capabilitiesSet.noDiagnostic,
							completion: {
								// fix https://github.com/johnsoncodehk/volar/issues/1905
								additional: true,
							},
							rename: {
								normalize: camelize,
								apply: keepHyphenateName,
							},
						},
					},
				);
				identifiers.add(camelize('v-' + prop.name));
				codeGen.append(`)(`);
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
				codeGen.append(`)`);
				codeGen.mappings.push({
					sourceRange: {
						start: prop.loc.start.offset,
						end: prop.loc.end.offset,
					},
					mappedRange: {
						start: diagStart,
						end: codeGen.text.length,
					},
					kind: SourceMaps.MappingKind.Totally,
					data: {
						vueTag: 'template',
						capabilities: capabilitiesSet.diagnosticOnly,
					},
				});
				codeGen.append(`;\n`);
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
				codeGen.append(`// @ts-ignore\n`);
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
				codeGen.append(`;\n`);
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
				codeGen.append(`__VLS_styleScopedClasses = (`);
				writeCode(
					prop.exp.content,
					{
						start: prop.exp.loc.start.offset,
						end: prop.exp.loc.end.offset,
					},
					SourceMaps.MappingKind.Offset,
					{
						vueTag: 'template',
						capabilities: capabilitiesSet.scopedClassName,
					},
				);
				codeGen.append(`);\n`);
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
				codeGen.append(`const ${varDefaultBind} = `);
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
				codeGen.append(`;\n`);
				writeInterpolationVarsExtraCompletion();
				break;
			}
		}

		codeGen.append(`const ${varBinds} = {\n`);
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
					SourceMaps.MappingKind.Offset,
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
				codeGen.append(`: `);
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
				codeGen.append(`,\n`);
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
					SourceMaps.MappingKind.Offset,
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
				codeGen.append(`: (`);
				codeGen.append(propValue);
				codeGen.append(`),\n`);
			}
		}
		codeGen.append(`};\n`);

		writeInterpolationVarsExtraCompletion();

		if (hasDefaultBind) {
			codeGen.append(`var ${varSlot}!: typeof ${varDefaultBind} & typeof ${varBinds};\n`);
		}
		else {
			codeGen.append(`var ${varSlot}!: typeof ${varBinds};\n`);
		}

		if (slotNameExp) {
			const varSlotExp = `__VLS_${elementIndex++}`;
			const varSlotExp2 = `__VLS_${elementIndex++}`;
			codeGen.append(`const ${varSlotExp} = ${slotNameExp};\n`);
			codeGen.append(`var ${varSlotExp2}!: typeof ${varSlotExp};\n`);
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
	function writeObjectProperty(mapCode: string, sourceRange: SourceMaps.MappingRange, mapMode: SourceMaps.MappingKind, data: EmbeddedFileMappingData, cacheOn: any) {
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
	function writePropertyAccess2(mapCode: string, sourceRanges: SourceMaps.MappingRange[], data: EmbeddedFileMappingData) {
		const sourceRange = sourceRanges[0];
		const mode = writePropertyAccess(mapCode, sourceRange, data);

		for (let i = 1; i < sourceRanges.length; i++) {
			const sourceRange = sourceRanges[i];
			if (mode === 1 || mode === 2) {
				codeGen.mappings.push({
					sourceRange,
					mappedRange: {
						start: codeGen.text.length - mapCode.length,
						end: codeGen.text.length,
					},
					kind: sourceRange.end - sourceRange.start === mapCode.length ? SourceMaps.MappingKind.Offset : SourceMaps.MappingKind.Expand,
					data,
				});
			}
			else if (mode === 3) {
				codeGen.mappings.push({
					sourceRange,
					mappedRange: {
						start: codeGen.text.length - `['${mapCode}']`.length,
						end: codeGen.text.length - `']`.length,
					},
					kind: SourceMaps.MappingKind.Offset,
					additional: [
						{
							sourceRange,
							mappedRange: {
								start: codeGen.text.length - `'${mapCode}']`.length,
								end: codeGen.text.length - `]`.length,
							},
							kind: SourceMaps.MappingKind.Totally,
						}
					],
					data,
				});
			}
		}
	}
	function writePropertyAccess(mapCode: string, sourceRange: SourceMaps.MappingRange, data: EmbeddedFileMappingData, checkValid = true) {
		if (checkValid && validTsVar.test(mapCode)) {
			codeGen.append(`.`);
			if (sourceRange.end - sourceRange.start === mapCode.length) {
				writeCode(mapCode, sourceRange, SourceMaps.MappingKind.Offset, data);
			}
			else {
				writeCode(mapCode, sourceRange, SourceMaps.MappingKind.Expand, data);
			}
			return 1;
		}
		else if (mapCode.startsWith('[') && mapCode.endsWith(']')) {
			writeCode(mapCode, sourceRange, SourceMaps.MappingKind.Offset, data);
			return 2;
		}
		else {
			codeGen.append(`[`);
			writeCodeWithQuotes(mapCode, sourceRange, data);
			codeGen.append(`]`);
			return 3;
		}
	}
	function writeCodeWithQuotes(mapCode: string, sourceRanges: SourceMaps.MappingRange | SourceMaps.MappingRange[], data: EmbeddedFileMappingData) {
		const addText = `'${mapCode}'`;
		for (const sourceRange of 'length' in sourceRanges ? sourceRanges : [sourceRanges]) {
			codeGen.mappings.push({
				sourceRange,
				mappedRange: {
					start: codeGen.text.length + 1,
					end: codeGen.text.length + addText.length - 1,
				},
				kind: SourceMaps.MappingKind.Offset,
				additional: [
					{
						sourceRange,
						mappedRange: {
							start: codeGen.text.length,
							end: codeGen.text.length + addText.length,
						},
						kind: SourceMaps.MappingKind.Totally,
					}
				],
				data,
			});
		}
		codeGen.append(addText);
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
				codeGen.append(frag);
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
					codeGen.append(frag.substring(0, -fragOffset));
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
						SourceMaps.MappingKind.Offset,
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
					codeGen.append(frag);
				}
				codeGen.append(addSubfix);
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

		codeGen.append('[');
		for (const _vars of tempVars) {
			for (const v of _vars) {
				codeGen.append(v.text, v.offset, {
					vueTag: 'template',
					capabilities: {
						completion: {
							additional: true,
						},
					},
				});
				codeGen.append(',');
			}
		}
		codeGen.append('];\n');
		tempVars.length = 0;
	}
	function writeFormatCode(mapCode: string, sourceOffset: number, formatWrapper: [string, string]) {
		formatCodeGen.append(formatWrapper[0]);
		const targetRange = formatCodeGen.append(mapCode);
		formatCodeGen.mappings.push({
			mappedRange: targetRange,
			sourceRange: {
				start: sourceOffset,
				end: sourceOffset + mapCode.length,
			},
			kind: SourceMaps.MappingKind.Offset,
			data: {
				vueTag: 'template',
				capabilities: {},
			},
		});
		formatCodeGen.append(formatWrapper[1]);
		formatCodeGen.append(`\n;\n`);
	}
	function writeCode(mapCode: string, sourceRange: SourceMaps.MappingRange, mode: SourceMaps.MappingKind, data: EmbeddedFileMappingData) {
		const targetRange = codeGen.append(mapCode);
		codeGen.mappings.push({
			sourceRange,
			mappedRange: targetRange,
			kind: mode,
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

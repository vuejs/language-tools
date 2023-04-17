import { Segment } from '@volar/source-map';
import { FileRangeCapabilities } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { VueCompilerOptions } from '../types';
import { colletVars, walkInterpolationFragment } from '../utils/transform';
import { minimatch } from 'minimatch';
import * as muggle from 'muggle-string';

const capabilitiesPresets = {
	all: FileRangeCapabilities.full,
	allWithHiddenParam: { ...FileRangeCapabilities.full, __hiddenParam: true /* TODO */ } as FileRangeCapabilities,
	noDiagnostic: { ...FileRangeCapabilities.full, diagnostic: false } satisfies FileRangeCapabilities,
	diagnosticOnly: { diagnostic: true } satisfies FileRangeCapabilities,
	tagHover: { hover: true } satisfies FileRangeCapabilities,
	event: { hover: true, diagnostic: true } satisfies FileRangeCapabilities,
	tagReference: { references: true, definition: true, rename: { normalize: undefined, apply: noEditApply } } satisfies FileRangeCapabilities,
	attr: { hover: true, diagnostic: true, references: true, definition: true, rename: true } satisfies FileRangeCapabilities,
	attrReference: { references: true, definition: true, rename: true } satisfies FileRangeCapabilities,
	slotProp: { references: true, definition: true, rename: true, diagnostic: true } satisfies FileRangeCapabilities,
	scopedClassName: { references: true, definition: true, rename: true, completion: true } satisfies FileRangeCapabilities,
	slotName: { hover: true, diagnostic: true, references: true, definition: true, completion: true } satisfies FileRangeCapabilities,
	slotNameExport: { hover: true, diagnostic: true, references: true, definition: true, /* referencesCodeLens: true */ } satisfies FileRangeCapabilities,
	refAttr: { references: true, definition: true, rename: true } satisfies FileRangeCapabilities,
};
const formatBrackets = {
	normal: ['`${', '}`'] as [string, string],
	// fix https://github.com/johnsoncodehk/volar/issues/1210
	// fix https://github.com/johnsoncodehk/volar/issues/2305
	curly: ['0 +', '+ 0;'] as [string, string],
};
const validTsVar = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
// @ts-ignore
const transformContext: CompilerDOM.TransformContext = {
	onError: () => { },
	helperString: str => str.toString(),
	replaceNode: () => { },
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
	ts: typeof import('typescript/lib/tsserverlibrary'),
	vueCompilerOptions: VueCompilerOptions,
	sourceTemplate: string,
	sourceLang: string,
	templateAst: CompilerDOM.RootNode,
	hasScriptSetupSlots: boolean,
	cssScopedClasses: string[] = [],
) {

	const nativeTags = new Set(vueCompilerOptions.nativeTags);
	const codes: Segment<FileRangeCapabilities>[] = [];
	const formatCodes: Segment<FileRangeCapabilities>[] = [];
	const cssCodes: Segment<FileRangeCapabilities>[] = [];
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

	let hasSlot = false;
	let elementIndex = 0;

	const componentVars = writeComponentVars();

	visitNode(templateAst, undefined);

	writeStyleScopedClasses();

	declareSlots();

	writeInterpolationVarsExtraCompletion();

	return {
		codes,
		formatCodes,
		cssCodes,
		tagNames,
		identifiers,
		hasSlot,
	};

	function declareSlots() {

		if (hasScriptSetupSlots) {
			return;
		}

		codes.push(`var __VLS_slots!: `);
		for (const [exp, slot] of slotExps) {
			hasSlot = true;
			codes.push(`Partial<Record<NonNullable<typeof ${exp}>, (_: typeof ${slot.varName}) => any>> &\n`);
		}
		codes.push(`{\n`);
		for (const [name, slot] of slots) {
			hasSlot = true;
			writeObjectProperty(
				name,
				slot.loc, // TODO: SourceMaps.MappingKind.Expand
				{
					...capabilitiesPresets.slotNameExport,
					referencesCodeLens: true,
				},
				slot.nodeLoc,
			);
			codes.push(`?(_: typeof ${slot.varName}): any,\n`);
		}
		codes.push(`}`);
		codes.push(`;\n`);
	}
	function writeStyleScopedClasses() {

		codes.push(`if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {\n`);
		for (const { className, offset } of scopedClasses) {
			codes.push(`__VLS_styleScopedClasses[`);
			writeCodeWithQuotes(
				className,
				offset,
				{
					...capabilitiesPresets.scopedClassName,
					displayWithLink: cssScopedClassesSet.has(className),
				},
			);
			codes.push(`];\n`);
		}
		codes.push('}\n');
	}
	function writeComponentVars() {

		const data: Record<string, string> = {};

		codes.push(`let __VLS_templateComponents!: {}\n`);

		for (const tagName in tagNames) {

			if (nativeTags.has(tagName))
				continue;

			const isNamespacedTag = tagName.indexOf('.') >= 0;
			if (isNamespacedTag)
				continue;

			const names = new Set([
				// order is important: https://github.com/johnsoncodehk/volar/issues/2010
				capitalize(camelize(tagName)),
				camelize(tagName),
				tagName,
			]);
			const varName = validTsVar.test(tagName) ? tagName : capitalize(camelize(tagName.replace(/:/g, '-')));

			codes.push(`& import('./__VLS_types.js').WithComponent<'${varName}', typeof __VLS_components, ${[...names].map(name => `'${name}'`).join(', ')}>\n`);

			data[tagName] = varName;
		}

		codes.push(`;\n`);

		for (const tagName in tagNames) {

			const varName = data[tagName];
			if (!varName)
				continue;

			const tagOffsets = tagNames[tagName];
			const tagRanges: [number, number][] = tagOffsets.map(offset => [offset, offset + tagName.length]);
			const names = new Set([
				// order is important: https://github.com/johnsoncodehk/volar/issues/2010
				capitalize(camelize(tagName)),
				camelize(tagName),
				tagName,
			]);

			for (const name of names) {
				for (const tagRange of tagRanges) {
					codes.push('__VLS_components');
					writePropertyAccess(
						name,
						tagRange,
						{
							...capabilitiesPresets.tagReference,
							rename: {
								normalize: tagName === name ? capabilitiesPresets.tagReference.rename.normalize : camelizeComponentName,
								apply: getRenameApply(tagName),
							},
						},
					);
					codes.push(';');
				}
			}
			codes.push('\n');

			codes.push('// @ts-ignore\n'); // #2304
			codes.push(`[`);
			for (const tagRange of tagRanges) {
				codes.push([
					varName,
					'template',
					tagRange,
					{
						completion: {
							additional: true,
							autoImportOnly: true,
						},
					},
				]);
				codes.push(',');
			}
			codes.push(`];\n`);
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
				capabilitiesPresets.all,
				'(',
				');\n',
				node.content.loc,
			);
			writeInterpolationVarsExtraCompletion();
			const lines = content.split('\n');
			appendFormattingCode(
				content,
				start,
				lines.length <= 1 ? formatBrackets.curly : [
					formatBrackets.curly[0],
					lines[lines.length - 1].trim() === '' ? '' : formatBrackets.curly[1],
				],
			);
		}
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			// v-if / v-else-if / v-else

			let originalBlockConditionsLength = blockConditions.length;

			for (let i = 0; i < node.branches.length; i++) {

				const branch = node.branches[i];

				if (i === 0)
					codes.push('if');
				else if (branch.condition)
					codes.push('else if');
				else
					codes.push('else');

				let addedBlockCondition = false;

				if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					codes.push(` `);
					const beforeCodeLength = codes.length;
					writeInterpolation(
						branch.condition.content,
						branch.condition.loc.start.offset,
						capabilitiesPresets.all,
						'(',
						')',
						branch.condition.loc,
					);
					const afterCodeLength = codes.length;
					appendFormattingCode(
						branch.condition.content,
						branch.condition.loc.start.offset,
						formatBrackets.normal,
					);

					blockConditions.push(muggle.toString(codes.slice(beforeCodeLength, afterCodeLength)));
					addedBlockCondition = true;
				}

				codes.push(` {\n`);
				writeInterpolationVarsExtraCompletion();
				for (const childNode of branch.children) {
					visitNode(childNode, parentEl);
				}
				codes.push('}\n');

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

			codes.push(`for (const [`);
			if (leftExpressionRange && leftExpressionText) {

				const collectAst = createTsAst(node.parseResult, `const [${leftExpressionText}]`);
				colletVars(ts, collectAst, forBlockVars);

				for (const varName of forBlockVars)
					localVars[varName] = (localVars[varName] ?? 0) + 1;

				codes.push([leftExpressionText, 'template', leftExpressionRange.start, capabilitiesPresets.all]);
				appendFormattingCode(leftExpressionText, leftExpressionRange.start, formatBrackets.normal);
			}
			codes.push(`] of (await import('./__VLS_types.js')).getVForSourceType`);
			if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				writeInterpolation(
					source.content,
					source.loc.start.offset,
					capabilitiesPresets.all,
					'(',
					')',
					source.loc,
				);
				appendFormattingCode(
					source.content,
					source.loc.start.offset,
					formatBrackets.normal,
				);

				codes.push(`) {\n`);

				writeInterpolationVarsExtraCompletion();

				for (const childNode of node.children) {
					visitNode(childNode, parentEl);
				}

				codes.push('}\n');
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
			codes.push(`// Unprocessed node type: ${node.type} json: ${JSON.stringify(node.loc)}\n`);
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

		codes.push(`{\n`);

		const startTagOffset = node.loc.start.offset + sourceTemplate.substring(node.loc.start.offset).indexOf(node.tag);
		let endTagOffset = !node.isSelfClosing && sourceLang === 'html' ? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) : undefined;

		if (endTagOffset === startTagOffset) {
			endTagOffset = undefined;
		}


		let propsFailedExps: CompilerDOM.SimpleExpressionNode[] = [];

		const tagOffsets = endTagOffset !== undefined ? [startTagOffset, endTagOffset] : [startTagOffset];
		const isIntrinsicElement = nativeTags.has(node.tag);
		const isNamespacedTag = node.tag.indexOf('.') >= 0;
		const componentVar = `__VLS_${elementIndex++}`;
		const componentInstanceVar = `__VLS_${elementIndex++}`;
		const componentCtxVar = `__VLS_${elementIndex++}`;

		if (isIntrinsicElement) {
			codes.push(`const ${componentVar} = (await import('./__VLS_types.js')).asFunctionalComponent(({} as import('./__VLS_types.js').IntrinsicElements)[`);
			writeCodeWithQuotes(
				node.tag,
				tagOffsets[0],
				capabilitiesPresets.diagnosticOnly,
			);
			codes.push(`]);\n`);
		}
		else if (isNamespacedTag) {
			codes.push(`const ${componentVar} = (await import('./__VLS_types.js')).asFunctionalComponent(${node.tag}, new ${node.tag}({`);
			writeProps(node, 'class', 'slots');
			codes.push(`}));\n`);;
		}
		else {
			codes.push(`const ${componentVar} = (await import('./__VLS_types.js')).asFunctionalComponent(`);
			codes.push(`__VLS_templateComponents['${componentVars[node.tag] ?? node.tag}'], `);
			codes.push(`new __VLS_templateComponents['${componentVars[node.tag] ?? node.tag}']({`);
			writeProps(node, 'class', 'slots');
			codes.push(`}));\n`);;
		}

		if (!vueCompilerOptions.jsxTemplates) {
			for (const offset of tagOffsets) {
				if (isIntrinsicElement) {
					codes.push(`({} as import('./__VLS_types.js').IntrinsicElements)`);
					writePropertyAccess(
						node.tag,
						offset,
						{
							...capabilitiesPresets.tagReference,
							...capabilitiesPresets.tagHover,
						},
					);
					codes.push(`;\n`);
				}
				else if (isNamespacedTag) {
					codes.push([
						node.tag,
						'template',
						[offset, offset + node.tag.length],
						capabilitiesPresets.all,
					]);
					codes.push(`;\n`);
				}
				else {
					if (componentVars[node.tag]) {
						codes.push(`__VLS_templateComponents.`);
					}
					codes.push([
						componentVars[node.tag] ?? node.tag,
						'template',
						[offset, offset + node.tag.length],
						{
							...capabilitiesPresets.tagHover,
							...capabilitiesPresets.diagnosticOnly,
						},
					]);
					codes.push(`;\n`);
				}
			}
		}
		else {

			codes.push([
				'',
				'template',
				node.loc.start.offset,
				capabilitiesPresets.diagnosticOnly,
			]);
			const tagCapabilities: FileRangeCapabilities = isIntrinsicElement || isNamespacedTag ? capabilitiesPresets.all : {
				...capabilitiesPresets.diagnosticOnly,
				...capabilitiesPresets.tagHover,
			};

			codes.push(`<`);
			if (componentVars[node.tag]) {
				codes.push([
					'',
					'template',
					startTagOffset,
					capabilitiesPresets.diagnosticOnly,
				]);
				codes.push(`__VLS_templateComponents.`);
			}
			codes.push([
				componentVars[node.tag] ?? node.tag,
				'template',
				[startTagOffset, startTagOffset + node.tag.length],
				tagCapabilities,
			]);
			codes.push(` `);
			const { propsFailedExps: unWriteExps } = writeProps(node, 'jsx', 'props');
			propsFailedExps = unWriteExps;

			if (endTagOffset === undefined) {
				codes.push(`/>`);
			}
			else {
				codes.push(`></`);
				if (componentVars[node.tag]) {
					codes.push(`__VLS_templateComponents.`);
				}
				codes.push([
					componentVars[node.tag] ?? node.tag,
					'template',
					[endTagOffset, endTagOffset + node.tag.length],
					tagCapabilities,
				]);
				codes.push(`>;\n`);
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
			codes.push([
				'',
				'template',
				startTagEnd,
				capabilitiesPresets.diagnosticOnly,
			]);
			codes.push(`\n`);
		}
		writeInterpolationVarsExtraCompletion();

		codes.push(`const ${componentInstanceVar} = ${componentVar}(`);

		let slotAndChildNodes: ReturnType<typeof writeChildren> | undefined;

		if (vueCompilerOptions.jsxTemplates) {
			codes.push(`{ `);
			writeProps(node, 'class', 'slots');
			codes.push(`}`);
		}
		else {
			codes.push(['', 'template', startTagOffset, capabilitiesPresets.diagnosticOnly]); // diagnostic start
			codes.push(`{ `);
			propsFailedExps = writeProps(node, 'class', 'props').propsFailedExps;
			codes.push(`}`);
			codes.push(['', 'template', startTagOffset + node.tag.length, capabilitiesPresets.diagnosticOnly]); // diagnostic end
		}
		if (parentEl) {
			codes.push(', {\n');
			slotAndChildNodes = writeChildren(node, parentEl);
			codes.push(`});\n`);
		}
		else {
			codes.push(`);\n`);
			for (const childNode of node.children) {
				visitNode(childNode, undefined);
			}
		}

		codes.push(`const ${componentCtxVar} = (await import('./__VLS_types.js')).pickFunctionalComponentCtx(${componentVar}, ${componentInstanceVar})!;\n`);

		for (const [slotName, { nodes, slotDir }] of Object.entries(slotAndChildNodes ?? {})) {

			const slotBlockVars: string[] = [];

			codes.push(`{\n`);

			codes.push(`declare const [`);

			if (slotDir?.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {

				const collectAst = createTsAst(slotDir, `(${slotDir.exp.content}) => {}`);
				colletVars(ts, collectAst, slotBlockVars);

				codes.push([
					slotDir.exp.content,
					'template',
					slotDir.exp.loc.start.offset,
					capabilitiesPresets.all,
				]);
				appendFormattingCode(
					slotDir.exp.content,
					slotDir.exp.loc.start.offset,
					formatBrackets.normal,
				);
			}

			codes.push(`]: Parameters<NonNullable<NonNullable<typeof ${componentCtxVar}.slots>['${slotName}']>>;\n`);

			slotBlockVars.forEach(varName => {
				localVars[varName] ??= 0;
				localVars[varName]++;
			});
			for (const childNode of nodes) {
				visitNode(childNode, undefined);
			}
			slotBlockVars.forEach(varName => {
				localVars[varName]--;
			});

			let isStatic = true;
			if (slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				isStatic = slotDir.arg.isStatic;
			}

			if (isStatic && slotDir && !slotDir.arg) {

				let offset = slotDir.loc.start.offset;

				if (slotDir.loc.source.startsWith('#'))
					offset += '#'.length;
				else if (slotDir.loc.source.startsWith('v-slot:'))
					offset += 'v-slot:'.length;

				codes.push(`'`);
				codes.push([
					'',
					'template',
					offset,
					{ completion: true },
				]);
				codes.push(`'/* empty slot name completion */\n`);
			}
			codes.push(`}\n`);
		}

		writeInterpolationVarsExtraCompletion();

		//#region 
		// fix https://github.com/johnsoncodehk/volar/issues/1775
		for (const failedExp of propsFailedExps) {
			writeInterpolation(
				failedExp.loc.source,
				failedExp.loc.start.offset,
				capabilitiesPresets.all,
				'(',
				')',
				failedExp.loc,
			);
			const fb = formatBrackets.normal;
			if (fb) {
				appendFormattingCode(
					failedExp.loc.source,
					failedExp.loc.start.offset,
					fb,
				);
			}
			codes.push(';\n');
		}

		writeInlineCss(node);

		const vScope = node.props.find(prop => prop.type === CompilerDOM.NodeTypes.DIRECTIVE && (prop.name === 'scope' || prop.name === 'data'));
		let inScope = false;
		let originalConditionsNum = blockConditions.length;

		if (vScope?.type === CompilerDOM.NodeTypes.DIRECTIVE && vScope.exp) {

			const scopeVar = `__VLS_${elementIndex++}`;
			const condition = `(await import('./__VLS_types.js')).withScope(__VLS_ctx, ${scopeVar})`;

			codes.push(`const ${scopeVar} = `);
			codes.push([
				vScope.exp.loc.source,
				'template',
				vScope.exp.loc.start.offset,
				capabilitiesPresets.all,
			]);
			codes.push(';\n');
			codes.push(`if (${condition}) {\n`);
			blockConditions.push(condition);
			inScope = true;
		}

		writeDirectives(node);
		writeElReferences(node); // <el ref="foo" />
		if (cssScopedClasses.length) writeClassScoped(node);
		writeEvents(node, componentInstanceVar, componentCtxVar);
		writeSlots(node, startTagOffset);

		if (inScope) {
			codes.push('}\n');
			blockConditions.length = originalConditionsNum;
		}
		//#endregion

		codes.push(`}\n`);
	}
	function writeEvents(node: CompilerDOM.ElementNode, componentInstanceVar: string, componentCtxVar: string) {

		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				const eventVar = `__VLS_${elementIndex++}`;
				codes.push(`let ${eventVar} = { '${prop.arg.loc.source}': `);
				codes.push(`(await import('./__VLS_types.js')).pickEvent(${componentCtxVar}.emit!, '${prop.arg.loc.source}' as const, ${componentInstanceVar}.__props!`);
				writePropertyAccess(
					camelize('on-' + prop.arg.loc.source), // onClickOutside
					[prop.arg.loc.start.offset, prop.arg.loc.end.offset],
					{
						...capabilitiesPresets.attrReference,
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
				codes.push(`) };\n`);
				codes.push(`${eventVar} = {\n`);
				if (prop.arg.loc.source.startsWith('[') && prop.arg.loc.source.endsWith(']')) {
					codes.push(`[(`);
					writeInterpolation(
						prop.arg.loc.source.slice(1, -1),
						prop.arg.loc.start.offset + 1,
						capabilitiesPresets.all,
						'',
						'',
						prop.arg.loc,
					);
					codes.push(`)!]`);
				}
				else {
					writeObjectProperty(
						prop.arg.loc.source,
						prop.arg.loc.start.offset,
						capabilitiesPresets.event,
						prop.arg.loc,
					);
				}
				codes.push(`: `);
				appendExpressionNode(prop);
				codes.push(`};\n`);
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
					capabilitiesPresets.all,
					'$event => {(',
					')}',
					prop.exp.loc,
				);
				appendFormattingCode(
					prop.exp.content,
					prop.exp.loc.start.offset,
					formatBrackets.normal,
				);
				codes.push(`;\n`);
			}

			function appendExpressionNode(prop: CompilerDOM.DirectiveNode) {
				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {

					const ast = createTsAst(prop.exp, prop.exp.content);
					let isCompoundExpression = true;

					if (ast.getChildCount() === 2) { // with EOF 
						ast.forEachChild(child_1 => {
							if (ts.isExpressionStatement(child_1)) {
								child_1.forEachChild(child_2 => {
									if (ts.isArrowFunction(child_2)) {
										isCompoundExpression = false;
									}
									else if (ts.isIdentifier(child_2)) {
										isCompoundExpression = false;
									}
								});
							}
							else if (ts.isFunctionDeclaration(child_1)) {
								isCompoundExpression = false;
							}
						});
					}

					let prefix = '(';
					let suffix = ')';

					if (isCompoundExpression) {

						prefix = '$event => {\n';
						for (const blockCondition of blockConditions) {
							prefix += `if (!(${blockCondition})) return;\n`;
						}
						suffix = '\n}';
					}

					let isFirstMapping = true;

					writeInterpolation(
						prop.exp.content,
						prop.exp.loc.start.offset,
						() => {
							if (isCompoundExpression && isFirstMapping) {
								isFirstMapping = false;
								return capabilitiesPresets.allWithHiddenParam;
							}
							return capabilitiesPresets.all;
						},
						prefix,
						suffix,
						prop.exp.loc,
					);
					appendFormattingCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						formatBrackets.normal,
					);
				}
				else {
					codes.push(`() => {}`);
				}
			}
		}

		writeInterpolationVarsExtraCompletion();
	}
	function writeProps(node: CompilerDOM.ElementNode, format: 'jsx' | 'class', mode: 'props' | 'slots') {

		let styleAttrNum = 0;
		let classAttrNum = 0;
		const propsFailedExps: CompilerDOM.SimpleExpressionNode[] = [];

		if (node.props.some(prop =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& !prop.arg
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		)) {
			// fix https://github.com/johnsoncodehk/volar/issues/2166
			styleAttrNum++;
			classAttrNum++;
		}

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
					|| (attrNameText === 'style' && ++styleAttrNum >= 2)
					|| (attrNameText === 'class' && ++classAttrNum >= 2)
					|| (attrNameText === 'name' && node.tag === 'slot') // #2308
				) {
					if (prop.exp && prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
						propsFailedExps.push(prop.exp);
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
				codes.push([
					'',
					'template',
					prop.loc.start.offset,
					getCaps(capabilitiesPresets.diagnosticOnly),
				]);
				if (!prop.arg) {
					writePropName(
						attrNameText,
						isStatic,
						[prop.loc.start.offset, prop.loc.start.offset + prop.loc.source.indexOf('=')],
						getCaps(capabilitiesPresets.attr),
						(prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}),
					);
				}
				else if (prop.exp?.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
					writePropName(
						propName,
						isStatic,
						[prop.arg.loc.start.offset, prop.arg.loc.start.offset + attrNameText.length], // patch style attr,
						{
							...getCaps(capabilitiesPresets.attr),
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
							...getCaps(capabilitiesPresets.attr),
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
						getCaps(capabilitiesPresets.all),
						'(',
						')',
						prop.exp.loc,
					);
					const fb = getFormatBrackets(formatBrackets.normal);
					if (fb) {
						appendFormattingCode(
							prop.exp.loc.source,
							prop.exp.loc.start.offset,
							fb,
						);
					}
				}
				else {
					codes.push('{}');
				}
				writePropValueSuffix(isStatic);
				codes.push([
					'',
					'template',
					prop.loc.end.offset,
					getCaps(capabilitiesPresets.diagnosticOnly),
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
							...getCaps(capabilitiesPresets.attr),
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
						codes.push('undefined');
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
					|| (attrNameText === 'style' && ++styleAttrNum >= 2)
					|| (attrNameText === 'class' && ++classAttrNum >= 2)
					|| (attrNameText === 'name' && node.tag === 'slot') // #2308
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
				codes.push([
					'',
					'template',
					prop.loc.start.offset,
					getCaps(capabilitiesPresets.diagnosticOnly),
				]);
				writePropName(
					propName,
					true,
					[prop.loc.start.offset, prop.loc.start.offset + prop.name.length],
					{
						...getCaps(capabilitiesPresets.attr),
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
					codes.push('true');
				}
				writePropValueSuffix(true);
				codes.push([
					'',
					'template',
					prop.loc.end.offset,
					getCaps(capabilitiesPresets.diagnosticOnly),
				]);
				writePropEnd(true);
				// original name
				if (attrNameText !== propName) {
					writePropStart(true);
					writePropName(
						attrNameText,
						true,
						prop.loc.start.offset,
						{
							...getCaps(capabilitiesPresets.attr),
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
						codes.push('true');
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
					codes.push('{...');
				else
					codes.push('...');
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					getCaps(capabilitiesPresets.all),
					'(',
					')',
					prop.exp.loc,
				);
				const fb = getFormatBrackets(formatBrackets.normal);
				if (fb) {
					appendFormattingCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						fb,
					);
				}
				if (format === 'jsx')
					codes.push('} ');
				else
					codes.push(', ');
			}
			else {
				// comment this line to avoid affecting comments in prop expressions
				// tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */ ");
			}
		}

		return { propsFailedExps };

		function writePropName(name: string, isStatic: boolean, sourceRange: number | [number, number], data: FileRangeCapabilities, cacheOn: any) {
			if (format === 'jsx' && isStatic) {
				codes.push([
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
				codes.push('={');
			}
			else {
				codes.push(': (');
			}
		}
		function writePropValueSuffix(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codes.push('}');
			}
			else {
				codes.push(')');
			}
		}
		function writePropStart(isStatic: boolean) {
			if (format === 'jsx' && !isStatic) {
				codes.push('{...{');
			}
		}
		function writePropEnd(isStatic: boolean) {
			if (format === 'jsx' && isStatic) {
				codes.push(' ');
			}
			else if (format === 'jsx' && !isStatic) {
				codes.push('}} ');
			}
			else {
				codes.push(', ');
			}
		}
		function getCaps(caps: FileRangeCapabilities): FileRangeCapabilities {
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
			const char = attrNode.loc.source.startsWith("'") ? "'" : '"';
			codes.push(char);
			let start = attrNode.loc.start.offset;
			let end = attrNode.loc.end.offset;
			let content = attrNode.loc.source;
			if (
				(content.startsWith('"') && content.endsWith('"'))
				|| (content.startsWith("'") && content.endsWith("'"))
			) {
				start++;
				end--;
				content = content.slice(1, -1);
			}
			codes.push([
				toUnicodeIfNeed(content),
				'template',
				[start, end],
				getCaps(capabilitiesPresets.all),
			]);
			codes.push(char);
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

				cssCodes.push(`${node.tag} { `);
				cssCodes.push([
					content,
					'template',
					prop.arg.loc.start.offset + start,
					capabilitiesPresets.all,
				]);
				cssCodes.push(` }\n`);
			}
		}
	}
	function writeChildren(node: CompilerDOM.ElementNode, parentEl: CompilerDOM.ElementNode) {

		const slotAndChildNodes: Record<string, { nodes: CompilerDOM.TemplateChildNode[], slotDir: CompilerDOM.DirectiveNode | undefined; }> = {};

		for (const child of node.children) {
			if (child.type === CompilerDOM.NodeTypes.COMMENT) {
				continue;
			}
			if (child.type !== CompilerDOM.NodeTypes.ELEMENT) {
				slotAndChildNodes.default ??= { nodes: [], slotDir: undefined };
				slotAndChildNodes.default.nodes.push(child);
			}
			else {
				const slotDir = child.props.find(prop => prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'slot') as CompilerDOM.DirectiveNode | undefined;
				const slotName = (slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && slotDir.arg.content) || 'default';
				slotAndChildNodes[slotName] ??= { nodes: [], slotDir: undefined };
				slotAndChildNodes[slotName].nodes.push(child);
				slotAndChildNodes[slotName].slotDir ??= slotDir;
			}
		}

		if (vueCompilerOptions.strictTemplates) {
			codes.push(['', 'template', parentEl.loc.start.offset, capabilitiesPresets.diagnosticOnly]);
			codes.push(`slots`);
			codes.push(['', 'template', parentEl.loc.end.offset, capabilitiesPresets.diagnosticOnly]);
		}
		else {
			codes.push(`slots`);
		}
		codes.push(`: {\n`);

		for (const [slotName, { nodes, slotDir }] of Object.entries(slotAndChildNodes)) {

			let isStatic = true;
			if (slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				isStatic = slotDir.arg.isStatic;
			}
			const argRange: [number, number] | undefined =
				slotDir
					? slotDir.arg
						? [slotDir.arg.loc.start.offset, slotDir.arg.loc.end.offset]
						: [slotDir.loc.start.offset, slotDir.loc.start.offset + slotDir.loc.source.split('=')[0].length]
					: undefined;

			if (!slotDir || !argRange) {
				codes.push([
					'',
					'template',
					Math.min(...nodes.map(node => node.loc.start.offset)),
					{ references: true },
				]);
				codes.push(slotName);
				codes.push([
					'',
					'template',
					Math.max(...nodes.map(node => node.loc.end.offset)),
					{ references: true },
				]);
			}
			else if (isStatic) {
				writeObjectProperty(
					slotName,
					argRange,
					{
						...capabilitiesPresets.slotName,
						completion: !!slotDir.arg,
					},
					slotDir.arg?.loc ?? slotDir.loc,
				);
			}
			else {
				codes.push(`[`);
				writeInterpolation(
					slotName,
					argRange[0] + 1,
					capabilitiesPresets.all,
					'',
					'',
					(slotDir.loc as any).slot_name ?? ((slotDir.loc as any).slot_name = {}),
				);
				codes.push(`]`);
			}

			codes.push(': {} as any,\n');
		}

		codes.push(`},\n`);

		return slotAndChildNodes;
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

				codes.push([
					'',
					'template',
					prop.loc.start.offset,
					capabilitiesPresets.diagnosticOnly,
				]);
				codes.push(`(await import('./__VLS_types.js')).directiveFunction(__VLS_ctx.`);
				codes.push([
					camelize('v-' + prop.name),
					'template',
					[prop.loc.start.offset, prop.loc.start.offset + 'v-'.length + prop.name.length],
					{
						...capabilitiesPresets.noDiagnostic,
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
				codes.push(`)`);
				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					writeInterpolation(
						prop.exp.content,
						prop.exp.loc.start.offset,
						capabilitiesPresets.all,
						'(',
						')',
						prop.exp.loc,
					);
					appendFormattingCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						formatBrackets.normal,
					);
				}
				codes.push([
					'',
					'template',
					prop.loc.end.offset,
					capabilitiesPresets.diagnosticOnly,
				]);
				codes.push(`;\n`);
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
				codes.push(`// @ts-ignore\n`);
				writeInterpolation(
					prop.value.content,
					prop.value.loc.start.offset + 1,
					capabilitiesPresets.refAttr,
					'(',
					')',
					prop.value.loc,
				);
				codes.push(`;\n`);
				writeInterpolationVarsExtraCompletion();
			}
		}
	}
	function writeClassScoped(node: CompilerDOM.ElementNode) {
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
				codes.push(`__VLS_styleScopedClasses = (`);
				codes.push([
					prop.exp.content,
					'template',
					prop.exp.loc.start.offset,
					capabilitiesPresets.scopedClassName,
				]);
				codes.push(`);\n`);
			}
		}
	}
	function writeSlots(node: CompilerDOM.ElementNode, startTagOffset: number) {

		if (node.tag !== 'slot')
			return;

		const varSlot = `__VLS_${elementIndex++}`;
		const slotNameExpNode = getSlotNameExpNode();

		if (hasScriptSetupSlots) {
			const slotNameExp = typeof slotNameExpNode === 'object' ? slotNameExpNode.content : slotNameExpNode;
			codes.push(['', 'template', node.loc.start.offset, capabilitiesPresets.diagnosticOnly]);
			codes.push(`__VLS_slots[`);
			codes.push(['', 'template', node.loc.start.offset, capabilitiesPresets.diagnosticOnly]);
			codes.push(slotNameExp);
			codes.push(['', 'template', node.loc.end.offset, capabilitiesPresets.diagnosticOnly]);
			codes.push(`]`);
			codes.push(['', 'template', node.loc.end.offset, capabilitiesPresets.diagnosticOnly]);
			codes.push(`?.({\n`);
		}
		else {
			codes.push(`var ${varSlot} = {\n`);
		}
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& !prop.arg
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				codes.push(`...`);
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					capabilitiesPresets.attrReference,
					'(',
					')',
					prop.exp.loc,
				);
				codes.push(`,\n`);
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content !== 'name'
			) {
				writeObjectProperty(
					prop.arg.content,
					[prop.arg.loc.start.offset, prop.arg.loc.end.offset],
					{
						...capabilitiesPresets.slotProp,
						rename: {
							normalize: camelize,
							apply: getRenameApply(prop.arg.content),
						},
					},
					prop.arg.loc,
				);
				codes.push(`: `);
				writeInterpolation(
					prop.exp.content,
					prop.exp.loc.start.offset,
					capabilitiesPresets.attrReference,
					'(',
					')',
					prop.exp.loc,
				);
				codes.push(`,\n`);
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
						...capabilitiesPresets.attr,
						rename: {
							normalize: camelize,
							apply: getRenameApply(prop.name),
						},
					},
					prop.loc,
				);
				codes.push(`: (`);
				codes.push(propValue);
				codes.push(`),\n`);
			}
		}
		codes.push(hasScriptSetupSlots ? `});\n` : `};\n`);

		writeInterpolationVarsExtraCompletion();

		if (hasScriptSetupSlots) {
			return;
		}

		if (slotNameExpNode) {
			const varSlotExp = `__VLS_${elementIndex++}`;
			codes.push(`var ${varSlotExp} = `);
			if (typeof slotNameExpNode === 'string') {
				codes.push(slotNameExpNode);
			}
			else {
				writeInterpolation(slotNameExpNode.content, undefined, undefined, '(', ')', slotNameExpNode);
			}
			codes.push(`;\n`);
			slotExps.set(varSlotExp, {
				varName: varSlot,
			});
		}
		else {
			const slotName = getSlotName();
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
		function getSlotNameExpNode() {
			for (const prop2 of node.props) {
				if (prop2.type === CompilerDOM.NodeTypes.DIRECTIVE && prop2.name === 'bind' && prop2.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop2.arg.content === 'name') {
					if (prop2.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
						return prop2.exp;
					}
				}
			}
			return `('${getSlotName()}' as const)`;
		}
	}
	function writeObjectProperty(mapCode: string, sourceRange: number | [number, number], data: FileRangeCapabilities, cacheOn: any) {
		if (validTsVar.test(mapCode)) {
			codes.push([mapCode, 'template', sourceRange, data]);
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
	function writePropertyAccess(mapCode: string, sourceRange: number | [number, number], data: FileRangeCapabilities) {
		if (validTsVar.test(mapCode)) {
			codes.push(`.`);
			codes.push([mapCode, 'template', sourceRange, data]);
		}
		else if (mapCode.startsWith('[') && mapCode.endsWith(']')) {
			codes.push([mapCode, 'template', sourceRange, data]);
		}
		else {
			codes.push(`[`);
			writeCodeWithQuotes(mapCode, sourceRange, data);
			codes.push(`]`);
		}
	}
	function writeCodeWithQuotes(mapCode: string, sourceRange: number | [number, number], data: FileRangeCapabilities) {
		codes.push([
			'',
			'template',
			typeof sourceRange === 'number' ? sourceRange : sourceRange[0],
			data,
		]);
		codes.push(`'`);
		codes.push([mapCode, 'template', sourceRange, data]);
		codes.push(`'`);
		codes.push([
			'',
			'template',
			typeof sourceRange === 'number' ? sourceRange : sourceRange[1],
			data,
		]);
	}
	function writeInterpolation(
		mapCode: string,
		sourceOffset: number | undefined,
		data: FileRangeCapabilities | (() => FileRangeCapabilities) | undefined,
		prefix: string,
		suffix: string,
		cacheOn: any,
	) {
		const ast = createTsAst(cacheOn, prefix + mapCode + suffix);
		const vars = walkInterpolationFragment(ts, prefix + mapCode + suffix, ast, (frag, fragOffset, isJustForErrorMapping) => {
			if (fragOffset === undefined) {
				codes.push(frag);
			}
			else {
				fragOffset -= prefix.length;
				let addSuffix = '';
				const overLength = fragOffset + frag.length - mapCode.length;
				if (overLength > 0) {
					addSuffix = frag.substring(frag.length - overLength);
					frag = frag.substring(0, frag.length - overLength);
				}
				if (fragOffset < 0) {
					codes.push(frag.substring(0, -fragOffset));
					frag = frag.substring(-fragOffset);
					fragOffset = 0;
				}
				if (sourceOffset !== undefined && data !== undefined) {
					codes.push([
						frag,
						'template',
						sourceOffset + fragOffset,
						isJustForErrorMapping
							? capabilitiesPresets.diagnosticOnly
							: typeof data === 'function' ? data() : data,
					]);
				}
				else {
					codes.push(frag);
				}
				codes.push(addSuffix);
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

		codes.push('// @ts-ignore\n'); // #2304
		codes.push('[');
		for (const _vars of tempVars) {
			for (const v of _vars) {
				codes.push([v.text, 'template', v.offset, { completion: { additional: true } }]);
				codes.push(',');
			}
		}
		codes.push('];\n');
		tempVars.length = 0;
	}
	function appendFormattingCode(mapCode: string, sourceOffset: number, formatWrapper: [string, string]) {
		formatCodes.push(formatWrapper[0]);
		formatCodes.push([mapCode, 'template', sourceOffset, {}]);
		formatCodes.push(formatWrapper[1]);
		formatCodes.push(`\n`);
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
		const temp = value.charCodeAt(0).toString(16).padStart(4, '0');
		if (temp.length > 2) {
			return '\\u' + temp;
		}
		return value;
	}).join('');
}
function camelizeComponentName(newName: string) {
	return camelize('-' + newName);
}
function getRenameApply(oldName: string) {
	return oldName === hyphenate(oldName) ? hyphenate : noEditApply;
}
function noEditApply(n: string) {
	return n;
}
function getModelValuePropName(node: CompilerDOM.ElementNode, vueVersion: number, vueCompilerOptions: VueCompilerOptions) {

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

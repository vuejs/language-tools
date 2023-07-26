import { Segment } from '@volar/source-map';
import { FileRangeCapabilities } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { Sfc, VueCompilerOptions } from '../types';
import { colletVars, walkInterpolationFragment } from '../utils/transform';
import { minimatch } from 'minimatch';
import * as muggle from 'muggle-string';

const capabilitiesPresets = {
	all: FileRangeCapabilities.full,
	allWithHiddenParam: {
		...FileRangeCapabilities.full, __hint: {
			setting: 'vue.inlayHints.inlineHandlerLeading',
			label: '$event =>',
			tooltip: [
				'`$event` is a hidden parameter, you can use it in this callback.',
				'To hide this hint, set `vue.inlayHints.inlineHandlerLeading` to `false` in IDE settings.',
				'[More info](https://github.com/vuejs/language-tools/issues/2445#issuecomment-1444771420)',
			].join('\n\n'),
			paddingRight: true,
		} /* TODO */
	} as FileRangeCapabilities,
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
	normal: ['`${', '}`;'] as [string, string],
	// fix https://github.com/vuejs/language-tools/issues/1210
	// fix https://github.com/vuejs/language-tools/issues/2305
	curly: ['0 +', '+ 0;'] as [string, string],
	event: ['() => ', ';'] as [string, string],
};
const validTsVarReg = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;
const colonReg = /:/g;
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

type Code = Segment<FileRangeCapabilities>;

export function generate(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	sourceTemplate: string,
	sourceLang: string,
	sfc: Sfc,
	hasScriptSetupSlots: boolean,
	codegenStack: boolean,
) {

	const nativeTags = new Set(vueCompilerOptions.nativeTags);
	const [codes, codeStacks] = codegenStack ? muggle.track([] as Code[]) : [[], []];
	const [formatCodes, formatCodeStacks] = codegenStack ? muggle.track([] as Code[]) : [[], []];
	const [cssCodes, cssCodeStacks] = codegenStack ? muggle.track([] as Code[]) : [[], []];
	const slots = new Map<string, { varName: string; loc: [number, number]; nodeLoc: any; }>();
	const slotExps = new Map<string, { varName: string; }>();
	const tagNames = collectTagOffsets();
	const localVars: Record<string, number> = {};
	const tempVars: ReturnType<typeof walkInterpolationFragment>[] = [];
	const identifiers = new Set<string>();
	const scopedClasses: { className: string, offset: number; }[] = [];
	const blockConditions: string[] = [];

	let hasSlot = false;
	let elementIndex = 0;
	let ignoreStart: undefined | number;
	let expectedErrorStart: undefined | number;
	let expectedErrorNode: CompilerDOM.CommentNode | undefined;

	generatePreResolveComponents();

	if (sfc.templateAst) {
		visitNode(sfc.templateAst, undefined, undefined, undefined);
	}

	generateStyleScopedClasses();

	if (!hasScriptSetupSlots) {
		codes.push(
			'var __VLS_slots!:',
			...createSlotsTypeCode(),
			';\n',
		);
	}

	generateAutoImportCompletionCode();

	return {
		codes,
		codeStacks,
		formatCodes,
		formatCodeStacks,
		cssCodes,
		cssCodeStacks,
		tagNames,
		identifiers,
		hasSlot,
	};

	function createSlotsTypeCode(): Code[] {
		const codes: Code[] = [];
		for (const [exp, slot] of slotExps) {
			hasSlot = true;
			codes.push(`Partial<Record<NonNullable<typeof ${exp}>, (_: typeof ${slot.varName}) => any>> &\n`);
		}
		codes.push(`{\n`);
		for (const [name, slot] of slots) {
			hasSlot = true;
			codes.push(
				...createObjectPropertyCode([
					name,
					'template',
					slot.loc,
					{
						...capabilitiesPresets.slotNameExport,
						referencesCodeLens: true,
					},
				], slot.nodeLoc),
			);
			codes.push(`?(_: typeof ${slot.varName}): any,\n`);
		}
		codes.push(`}`);
		return codes;
	}

	function generateStyleScopedClasses() {

		const allClasses = new Set<string>();

		for (const block of sfc.styles) {
			if (block.scoped || vueCompilerOptions.experimentalResolveStyleCssClasses === 'always') {
				for (const className of block.classNames) {
					allClasses.add(className.text.substring(1));
				}
			}
		}

		codes.push(`if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {\n`);
		for (const { className, offset } of scopedClasses) {
			codes.push(`__VLS_styleScopedClasses[`);
			codes.push(...createStringLiteralKeyCode([
				className,
				'template',
				offset,
				{
					...capabilitiesPresets.scopedClassName,
					displayWithLink: allClasses.has(className),
				},
			]));
			codes.push(`];\n`);
		}
		codes.push('}\n');
	}

	function toCanonicalComponentName(tagText: string) {
		return validTsVarReg.test(tagText) ? tagText : capitalize(camelize(tagText.replace(colonReg, '-')));
	}

	function getPossibleOriginalComponentName(tagText: string) {
		return [...new Set([
			// order is important: https://github.com/vuejs/language-tools/issues/2010
			capitalize(camelize(tagText)),
			camelize(tagText),
			tagText,
		])];
	}

	function generatePreResolveComponents() {

		codes.push(`let __VLS_resolvedLocalAndGlobalComponents!: {}\n`);

		for (const tagName in tagNames) {

			if (nativeTags.has(tagName))
				continue;

			const isNamespacedTag = tagName.indexOf('.') >= 0;
			if (isNamespacedTag)
				continue;

			codes.push(
				`& __VLS_WithComponent<'${toCanonicalComponentName(tagName)}', typeof __VLS_localComponents, `,
				// order is important: https://github.com/vuejs/language-tools/issues/2010
				`"${capitalize(camelize(tagName))}", `,
				`"${camelize(tagName)}", `,
				`"${tagName}"`,
				'>\n',
			);
		}

		codes.push(`;\n`);

		for (const tagName in tagNames) {

			const tagOffsets = tagNames[tagName];
			const tagRanges: [number, number][] = tagOffsets.map(offset => [offset, offset + tagName.length]);
			const names = nativeTags.has(tagName) ? [tagName] : getPossibleOriginalComponentName(tagName);

			for (const name of names) {
				for (const tagRange of tagRanges) {
					codes.push(
						nativeTags.has(tagName) ? '({} as __VLS_IntrinsicElements)' : '__VLS_components',
						...createPropertyAccessCode([
							name,
							'template',
							tagRange,
							{
								...capabilitiesPresets.tagReference,
								rename: {
									normalize: tagName === name ? capabilitiesPresets.tagReference.rename.normalize : camelizeComponentName,
									apply: getRenameApply(tagName),
								},
							},
						]),
						';',
					);
				}
			}
			codes.push('\n');

			if (nativeTags.has(tagName))
				continue;

			const isNamespacedTag = tagName.indexOf('.') >= 0;
			if (isNamespacedTag)
				continue;

			codes.push(
				'// @ts-ignore\n', // #2304
				'[',
			);
			const validName = toCanonicalComponentName(tagName);
			for (const tagRange of tagRanges) {
				codes.push([
					validName,
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
	}

	function collectTagOffsets() {

		const tagOffsetsMap: Record<string, number[]> = {};

		if (!sfc.templateAst) {
			return tagOffsetsMap;
		}

		walkElementNodes(sfc.templateAst, node => {
			if (node.tag === 'slot') {
				// ignore
			}
			else if (node.tag === 'component' || node.tag === 'Component') {
				for (const prop of node.props) {
					if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop.name === 'is' && prop.value) {
						const tag = prop.value.content;
						tagOffsetsMap[tag] ??= [];
						tagOffsetsMap[tag].push(prop.value.loc.start.offset + prop.value.loc.source.lastIndexOf(tag));
						break;
					}
				}
			}
			else {
				tagOffsetsMap[node.tag] ??= [];

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
			}
		});

		return tagOffsetsMap;
	}

	function resolveComment() {
		if (ignoreStart !== undefined) {
			for (let i = ignoreStart; i < codes.length; i++) {
				const code = codes[i];
				if (typeof code === 'string') {
					continue;
				}
				const cap = code[3];
				if (cap.diagnostic) {
					code[3] = {
						...cap,
						diagnostic: false,
					};
				}
			}
			ignoreStart = undefined;
		}
		if (expectedErrorStart !== undefined && expectedErrorStart !== codes.length && expectedErrorNode) {
			let errors = 0;
			const suppressError = () => {
				errors++;
				return false;
			};
			for (let i = expectedErrorStart; i < codes.length; i++) {
				const code = codes[i];
				if (typeof code === 'string') {
					continue;
				}
				const cap = code[3];
				if (cap.diagnostic) {
					code[3] = {
						...cap,
						diagnostic: {
							shouldReport: suppressError,
						},
					};
				}
			}
			codes.push(
				[
					'// @ts-expect-error',
					'template',
					[expectedErrorNode.loc.start.offset, expectedErrorNode.loc.end.offset],
					{
						diagnostic: {
							shouldReport: () => errors === 0,
						},
					},
				],
				'\n;\n',
			);
			expectedErrorStart = undefined;
			expectedErrorNode = undefined;
		}
	}

	function visitNode(
		node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.InterpolationNode | CompilerDOM.CompoundExpressionNode | CompilerDOM.TextNode | CompilerDOM.SimpleExpressionNode,
		parentEl: CompilerDOM.ElementNode | undefined,
		prevNode: CompilerDOM.TemplateChildNode | undefined,
		componentCtxVar: string | undefined,
	): void {

		resolveComment();

		if (prevNode?.type === CompilerDOM.NodeTypes.COMMENT) {
			const commentText = prevNode.content.trim().split(' ')[0];
			if (commentText.match(/^@vue-skip\b[\s\S]*/)) {
				return;
			}
			else if (commentText.match(/^@vue-ignore\b[\s\S]*/)) {
				ignoreStart = codes.length;
			}
			else if (commentText.match(/^@vue-expect-error\b[\s\S]*/)) {
				expectedErrorStart = codes.length;
				expectedErrorNode = prevNode;
			}
		}

		if (node.type === CompilerDOM.NodeTypes.ROOT) {
			let prev: CompilerDOM.TemplateChildNode | undefined;
			for (const childNode of node.children) {
				visitNode(childNode, parentEl, prev, componentCtxVar);
				prev = childNode;
			}
			resolveComment();
		}
		else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
			const vForNode = getVForNode(node);
			const vIfNode = getVIfNode(node);
			if (vForNode) {
				visitVForNode(vForNode, parentEl, componentCtxVar);
			}
			else if (vIfNode) {
				visitVIfNode(vIfNode, parentEl, componentCtxVar);
			}
			else {
				visitElementNode(node, parentEl, componentCtxVar);
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.TEXT_CALL) {
			// {{ var }}
			visitNode(node.content, parentEl, undefined, componentCtxVar);
		}
		else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
			// {{ ... }} {{ ... }}
			for (const childNode of node.children) {
				if (typeof childNode === 'object') {
					visitNode(childNode, parentEl, undefined, componentCtxVar);
				}
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
			// {{ ... }}

			let content = node.content.loc.source;
			let start = node.content.loc.start.offset;
			let leftCharacter: string;
			let rightCharacter: string;

			// fix https://github.com/vuejs/language-tools/issues/1787
			while ((leftCharacter = sourceTemplate.substring(start - 1, start)).trim() === '' && leftCharacter.length) {
				start--;
				content = leftCharacter + content;
			}
			while ((rightCharacter = sourceTemplate.substring(start + content.length, start + content.length + 1)).trim() === '' && rightCharacter.length) {
				content = content + rightCharacter;
			}

			codes.push(
				...createInterpolationCode(
					content,
					node.content.loc,
					start,
					capabilitiesPresets.all,
					'(',
					');\n',
				),
			);
			const lines = content.split('\n');
			formatCodes.push(
				...createFormatCode(
					content,
					start,
					lines.length <= 1 ? formatBrackets.curly : [
						formatBrackets.curly[0],
						lines[lines.length - 1].trim() === '' ? '' : formatBrackets.curly[1],
					],
				),
			);
		}
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			// v-if / v-else-if / v-else
			visitVIfNode(node, parentEl, componentCtxVar);
		}
		else if (node.type === CompilerDOM.NodeTypes.FOR) {
			// v-for
			visitVForNode(node, parentEl, componentCtxVar);
		}
		else if (node.type === CompilerDOM.NodeTypes.TEXT) {
			// not needed progress
		}
	}

	function visitVIfNode(node: CompilerDOM.IfNode, parentEl: CompilerDOM.ElementNode | undefined, componentCtxVar: string | undefined) {

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
				codes.push(
					...createInterpolationCode(
						branch.condition.content,
						branch.condition.loc,
						branch.condition.loc.start.offset,
						capabilitiesPresets.all,
						'(',
						')',
					),
				);
				const afterCodeLength = codes.length;

				formatCodes.push(
					...createFormatCode(
						branch.condition.content,
						branch.condition.loc.start.offset,
						formatBrackets.normal,
					),
				);

				blockConditions.push(muggle.toString(codes.slice(beforeCodeLength, afterCodeLength)));
				addedBlockCondition = true;
			}

			codes.push(` {\n`);

			let prev: CompilerDOM.TemplateChildNode | undefined;
			for (const childNode of branch.children) {
				visitNode(childNode, parentEl, prev, componentCtxVar);
				prev = childNode;
			}
			resolveComment();

			generateAutoImportCompletionCode();
			codes.push('}\n');

			if (addedBlockCondition) {
				blockConditions[blockConditions.length - 1] = `!(${blockConditions[blockConditions.length - 1]})`;
			}
		}

		blockConditions.length = originalBlockConditionsLength;
	}

	function visitVForNode(node: CompilerDOM.ForNode, parentEl: CompilerDOM.ElementNode | undefined, componentCtxVar: string | undefined) {

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
			formatCodes.push(...createFormatCode(leftExpressionText, leftExpressionRange.start, formatBrackets.normal));
		}
		codes.push(`] of __VLS_getVForSourceType`);
		if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			codes.push(
				'(',
				...createInterpolationCode(
					source.content,
					source.loc,
					source.loc.start.offset,
					capabilitiesPresets.all,
					'(',
					')',
				),
				'!)', // #3102
				') {\n',
			);

			let prev: CompilerDOM.TemplateChildNode | undefined;
			for (const childNode of node.children) {
				visitNode(childNode, parentEl, prev, componentCtxVar);
				prev = childNode;
			}
			resolveComment();

			generateAutoImportCompletionCode();
			codes.push('}\n');

			formatCodes.push(
				...createFormatCode(
					source.content,
					source.loc.start.offset,
					formatBrackets.normal,
				),
			);
		}

		for (const varName of forBlockVars)
			localVars[varName]--;
	}

	function visitElementNode(node: CompilerDOM.ElementNode, parentEl: CompilerDOM.ElementNode | undefined, componentCtxVar: string | undefined) {

		codes.push(`{\n`);

		const startTagOffset = node.loc.start.offset + sourceTemplate.substring(node.loc.start.offset).indexOf(node.tag);
		let endTagOffset = !node.isSelfClosing && sourceLang === 'html' ? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) : undefined;

		if (endTagOffset === startTagOffset) {
			endTagOffset = undefined;
		}

		let tag = node.tag;
		let tagOffsets = endTagOffset !== undefined ? [startTagOffset, endTagOffset] : [startTagOffset];
		let props = node.props;

		const propsFailedExps: CompilerDOM.SimpleExpressionNode[] = [];
		const isNamespacedTag = tag.indexOf('.') >= 0;
		const var_originalComponent = `__VLS_${elementIndex++}`;
		const var_functionalComponent = `__VLS_${elementIndex++}`;
		const var_componentInstance = `__VLS_${elementIndex++}`;

		let dynamicTagExp: CompilerDOM.ExpressionNode | undefined;

		if (tag === 'slot') {
			tagOffsets.length = 0;
		}
		else if (tag === 'component' || tag === 'Component') {
			tagOffsets.length = 0;
			for (const prop of node.props) {
				if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop.name === 'is' && prop.value) {
					tag = prop.value.content;
					tagOffsets = [prop.value.loc.start.offset + prop.value.loc.source.lastIndexOf(tag)];
					props = props.filter(p => p !== prop);
					break;
				}
				else if (prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.arg?.loc.source === 'is' && prop.exp) {
					dynamicTagExp = prop.exp;
					props = props.filter(p => p !== prop);
					break;
				}
			}
		}

		const isIntrinsicElement = nativeTags.has(tag) && tagOffsets.length;

		if (isIntrinsicElement) {
			codes.push(
				'const ',
				var_originalComponent,
				` = ({} as __VLS_IntrinsicElements)[`,
				...createStringLiteralKeyCode([
					tag,
					'template',
					tagOffsets[0],
					capabilitiesPresets.diagnosticOnly,
				]),
				'];\n',
			);
		}
		else if (isNamespacedTag) {
			codes.push(
				`const ${var_originalComponent} = `,
				...createInterpolationCode(tag, node.loc, startTagOffset, capabilitiesPresets.all, '', ''),
				';\n',
			);
		}
		else if (dynamicTagExp) {
			codes.push(
				`const ${var_originalComponent} = `,
				...createInterpolationCode(dynamicTagExp.loc.source, dynamicTagExp.loc, dynamicTagExp.loc.start.offset, capabilitiesPresets.all, '(', ')'),
				';\n',
			);
		}
		else {
			codes.push(`let ${var_originalComponent}!: `);
			for (const componentName of getPossibleOriginalComponentName(tag)) {
				codes.push(`'${componentName}' extends keyof typeof __VLS_ctx ? typeof __VLS_ctx${validTsVarReg.test(componentName) ? `.${componentName}` : `['${componentName}']`} : `);
			}
			codes.push(`typeof __VLS_resolvedLocalAndGlobalComponents['${toCanonicalComponentName(tag)}'];\n`);
		}

		codes.push(
			`const ${var_functionalComponent} = __VLS_asFunctionalComponent(`,
			`${var_originalComponent}, `,
		);
		if (isIntrinsicElement) {
			codes.push('{}');
		}
		else {
			codes.push(
				`new ${var_originalComponent}({`,
				...createPropsCode(node, props, 'extraReferences'),
				'})',
			);
		}
		codes.push(');\n');

		for (const offset of tagOffsets) {
			if (isNamespacedTag || dynamicTagExp) {
				continue;
			}
			else if (isIntrinsicElement) {
				codes.push(`({} as __VLS_IntrinsicElements).`);
				codes.push(
					[
						tag,
						'template',
						[offset, offset + tag.length],
						{
							...capabilitiesPresets.tagHover,
							...capabilitiesPresets.diagnosticOnly,
						},
					],
					';\n',
				);
			}
			else {
				const key = toCanonicalComponentName(tag);
				codes.push(`({} as { ${key}: typeof ${var_originalComponent} }).`);
				codes.push(
					[
						key,
						'template',
						[offset, offset + tag.length],
						{
							...capabilitiesPresets.tagHover,
							...capabilitiesPresets.diagnosticOnly,
						},
					],
					';\n',
				);
			}
		}

		codes.push(
			`const ${var_componentInstance} = ${var_functionalComponent}(`,
			// diagnostic start
			tagOffsets.length ? ['', 'template', tagOffsets[0], capabilitiesPresets.diagnosticOnly]
				: dynamicTagExp ? ['', 'template', startTagOffset, capabilitiesPresets.diagnosticOnly]
					: '',
			'{ ',
			...createPropsCode(node, props, 'normal', propsFailedExps),
			'}',
			// diagnostic end
			tagOffsets.length ? ['', 'template', tagOffsets[0] + tag.length, capabilitiesPresets.diagnosticOnly]
				: dynamicTagExp ? ['', 'template', startTagOffset + tag.length, capabilitiesPresets.diagnosticOnly]
					: '',
			`, ...__VLS_functionalComponentArgsRest(${var_functionalComponent}));\n`,
		);

		if (tag !== 'template' && tag !== 'slot') {
			componentCtxVar = `__VLS_${elementIndex++}`;
			codes.push(`const ${componentCtxVar} = __VLS_pickFunctionalComponentCtx(${var_originalComponent}, ${var_componentInstance})!;\n`);
			parentEl = node;
		}

		//#region
		// fix https://github.com/vuejs/language-tools/issues/1775
		for (const failedExp of propsFailedExps) {
			codes.push(
				...createInterpolationCode(
					failedExp.loc.source,
					failedExp.loc,
					failedExp.loc.start.offset,
					capabilitiesPresets.all,
					'(',
					')',
				),
				';\n',
			);
			const fb = formatBrackets.normal;
			if (fb) {
				formatCodes.push(
					...createFormatCode(
						failedExp.loc.source,
						failedExp.loc.start.offset,
						fb,
					),
				);
			}
		}

		generateInlineCss(props);

		const vScope = props.find(prop => prop.type === CompilerDOM.NodeTypes.DIRECTIVE && (prop.name === 'scope' || prop.name === 'data'));
		let inScope = false;
		let originalConditionsNum = blockConditions.length;

		if (vScope?.type === CompilerDOM.NodeTypes.DIRECTIVE && vScope.exp) {

			const scopeVar = `__VLS_${elementIndex++}`;
			const condition = `__VLS_withScope(__VLS_ctx, ${scopeVar})`;

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

		generateDirectives(node);
		generateElReferences(node); // <el ref="foo" />
		if (sfc.styles.some(s => s.scoped || vueCompilerOptions.experimentalResolveStyleCssClasses === 'always')) {
			generateClassScoped(node);
		}
		if (componentCtxVar) {
			generateEvents(node, var_functionalComponent, var_componentInstance, componentCtxVar);
		}
		if (node.tag === 'slot') {
			generateSlot(node, startTagOffset);
		}

		if (inScope) {
			codes.push('}\n');
			blockConditions.length = originalConditionsNum;
		}
		//#endregion

		const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as CompilerDOM.DirectiveNode;
		if (slotDir && componentCtxVar) {
			const slotBlockVars: string[] = [];
			codes.push(`{\n`);
			let hasProps = false;
			if (slotDir?.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {

				formatCodes.push(
					...createFormatCode(
						slotDir.exp.content,
						slotDir.exp.loc.start.offset,
						formatBrackets.normal,
					),
				);

				const collectAst = createTsAst(slotDir, `(${slotDir.exp.content}) => {}`);
				colletVars(ts, collectAst, slotBlockVars);
				hasProps = true;
				if (slotDir.exp.content.indexOf(':') === -1) {
					codes.push(
						'const [',
						[
							slotDir.exp.content,
							'template',
							slotDir.exp.loc.start.offset,
							capabilitiesPresets.all,
						],
						`] = __VLS_getSlotParams(`,
					);
				}
				else {
					codes.push(
						'const ',
						[
							slotDir.exp.content,
							'template',
							slotDir.exp.loc.start.offset,
							capabilitiesPresets.all,
						],
						` = __VLS_getSlotParam(`,
					);
				}
			}
			codes.push(
				['', 'template', (slotDir.arg ?? slotDir).loc.start.offset, capabilitiesPresets.diagnosticOnly],
				`(${componentCtxVar}.slots!)`,
				...(
					(slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && slotDir.arg.content)
						? createPropertyAccessCode([
							slotDir.arg.loc.source,
							'template',
							slotDir.arg.loc.start.offset,
							slotDir.arg.isStatic ? capabilitiesPresets.slotName : capabilitiesPresets.all
						], slotDir.arg.loc)
						: createPropertyAccessCode([
							'default',
							'template',
							[slotDir.loc.start.offset, slotDir.loc.start.offset + (slotDir.loc.source.startsWith('#') ? '#'.length : slotDir.loc.source.startsWith('v-slot:') ? 'v-slot:'.length : 0)],
							{ ...capabilitiesPresets.slotName, completion: false },
						])
				),
				['', 'template', (slotDir.arg ?? slotDir).loc.end.offset, capabilitiesPresets.diagnosticOnly],
			);
			if (hasProps) {
				codes.push(')');
			}
			codes.push(';\n');

			slotBlockVars.forEach(varName => {
				localVars[varName] ??= 0;
				localVars[varName]++;
			});

			let prev: CompilerDOM.TemplateChildNode | undefined;
			for (const childNode of node.children) {
				visitNode(childNode, parentEl, prev, componentCtxVar);
				prev = childNode;
			}
			resolveComment();

			slotBlockVars.forEach(varName => {
				localVars[varName]--;
			});
			let isStatic = true;
			if (slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				isStatic = slotDir.arg.isStatic;
			}
			if (isStatic && slotDir && !slotDir.arg) {
				codes.push(
					`${componentCtxVar}.slots!['`,
					[
						'',
						'template',
						slotDir.loc.start.offset + (slotDir.loc.source.startsWith('#') ? '#'.length : slotDir.loc.source.startsWith('v-slot:') ? 'v-slot:'.length : 0),
						{ completion: true },
					],
					`'/* empty slot name completion */]\n`,
				);
			}
			codes.push(`}\n`);
		}
		else {
			let prev: CompilerDOM.TemplateChildNode | undefined;
			for (const childNode of node.children) {
				visitNode(childNode, parentEl, prev, componentCtxVar);
				prev = childNode;
			}
			resolveComment();
		}

		codes.push(`}\n`);
	}

	function generateEvents(node: CompilerDOM.ElementNode, componentVar: string, componentInstanceVar: string, componentCtxVar: string) {

		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				const eventVar = `__VLS_${elementIndex++}`;
				codes.push(
					`let ${eventVar} = { '${prop.arg.loc.source}': `,
					`__VLS_pickEvent(${componentCtxVar}.emit!, '${prop.arg.loc.source}' as const, __VLS_componentProps(${componentVar}, ${componentInstanceVar})`,
					...createPropertyAccessCode([
						camelize('on-' + prop.arg.loc.source), // onClickOutside
						'template',
						[prop.arg.loc.start.offset, prop.arg.loc.end.offset],
						{
							...capabilitiesPresets.attrReference,
							rename: {
								// @click-outside -> onClickOutside
								normalize(newName) {
									return camelize('on-' + newName);
								},
								// onClickOutside -> @click-outside
								apply(newName) {
									const hName = hyphenate(newName);
									if (hyphenate(newName).startsWith('on-')) {
										return camelize(hName.slice('on-'.length));
									}
									return newName;
								},
							},
						},
					]),
					`) };\n`,
					`${eventVar} = {\n`,
				);
				if (prop.arg.loc.source.startsWith('[') && prop.arg.loc.source.endsWith(']')) {
					codes.push(
						'[(',
						...createInterpolationCode(
							prop.arg.loc.source.slice(1, -1),
							prop.arg.loc,
							prop.arg.loc.start.offset + 1,
							capabilitiesPresets.all,
							'',
							'',
						),
						')!]',
					);
				}
				else {
					codes.push(
						...createObjectPropertyCode([
							prop.arg.loc.source,
							'template',
							prop.arg.loc.start.offset,
							capabilitiesPresets.event,
						], prop.arg.loc)
					);
				}
				codes.push(`: `);
				appendExpressionNode(prop);
				codes.push(`};\n`);
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				// for vue 2 nameless event
				// https://github.com/johnsoncodehk/vue-tsc/issues/67
				codes.push(
					...createInterpolationCode(
						prop.exp.content,
						prop.exp.loc,
						prop.exp.loc.start.offset,
						capabilitiesPresets.all,
						'$event => {(',
						')}',
					),
					';\n',
				);
				formatCodes.push(
					...createFormatCode(
						prop.exp.content,
						prop.exp.loc.start.offset,
						formatBrackets.normal,
					),
				);
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

					codes.push(
						...createInterpolationCode(
							prop.exp.content,
							prop.exp.loc,
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
						),
					);
					formatCodes.push(
						...createFormatCode(
							prop.exp.content,
							prop.exp.loc.start.offset,
							isCompoundExpression ? formatBrackets.event : formatBrackets.normal,
						),
					);
				}
				else {
					codes.push(`() => {}`);
				}
			}
		}
	}

	function createPropsCode(node: CompilerDOM.ElementNode, props: CompilerDOM.ElementNode['props'], mode: 'normal' | 'extraReferences', propsFailedExps?: CompilerDOM.SimpleExpressionNode[]): Code[] {

		let styleAttrNum = 0;
		let classAttrNum = 0;

		if (props.some(prop =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& !prop.arg
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		)) {
			// fix https://github.com/vuejs/language-tools/issues/2166
			styleAttrNum++;
			classAttrNum++;
		}

		const codes: Code[] = [];

		let caps_all: FileRangeCapabilities = capabilitiesPresets.all;
		let caps_diagnosticOnly: FileRangeCapabilities = capabilitiesPresets.diagnosticOnly;
		let caps_attr: FileRangeCapabilities = capabilitiesPresets.attr;

		if (mode === 'extraReferences') {
			caps_all = {
				references: caps_all.references,
				rename: caps_all.rename,
			};
			caps_diagnosticOnly = {
				references: caps_diagnosticOnly.references,
				rename: caps_diagnosticOnly.rename,
			};
			caps_attr = {
				references: caps_attr.references,
				rename: caps_attr.rename,
			};
		}


		codes.push(`...{ `);
		for (const prop of props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				codes.push(
					...createObjectPropertyCode(camelize('on-' + prop.arg.loc.source)),
					': {} as any, ',
				);
			}
		}
		codes.push(`}, `);

		for (const prop of props) {
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
						propsFailedExps?.push(prop.exp);
					}
					continue;
				}

				let camelized = false;

				if (
					(!prop.arg || (prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)) // isStatic
					&& hyphenate(attrNameText) === attrNameText
					&& !vueCompilerOptions.htmlAttributes.some(pattern => minimatch(attrNameText!, pattern))
				) {
					attrNameText = camelize(attrNameText);
					camelized = true;
				}

				// camelize name
				codes.push([
					'',
					'template',
					prop.loc.start.offset,
					caps_diagnosticOnly,
				]);
				if (!prop.arg) {
					codes.push(
						...createObjectPropertyCode([
							attrNameText,
							'template',
							[prop.loc.start.offset, prop.loc.start.offset + prop.loc.source.indexOf('=')],
							caps_attr,
						], (prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {})),
					);
				}
				else if (prop.exp?.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
					codes.push(
						...createObjectPropertyCode([
							attrNameText,
							'template',
							[prop.arg.loc.start.offset, prop.arg.loc.start.offset + attrNameText.length], // patch style attr,
							{
								...caps_attr,
								rename: {
									normalize: camelize,
									apply: camelized ? hyphenate : noEditApply,
								},
							},
						], (prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {})),
					);
				}
				else {
					codes.push(
						...createObjectPropertyCode([
							attrNameText,
							'template',
							[prop.arg.loc.start.offset, prop.arg.loc.end.offset],
							{
								...caps_attr,
								rename: {
									normalize: camelize,
									apply: camelized ? hyphenate : noEditApply,
								},
							},
						], (prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {})),
					);
				}
				codes.push(': (');
				if (prop.exp && !(prop.exp.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY)) { // style='z-index: 2' will compile to {'z-index':'2'}
					codes.push(
						...createInterpolationCode(
							prop.exp.loc.source,
							prop.exp.loc,
							prop.exp.loc.start.offset,
							caps_all,
							'(',
							')',
						),
					);
					if (mode === 'normal') {
						formatCodes.push(
							...createFormatCode(
								prop.exp.loc.source,
								prop.exp.loc.start.offset,
								formatBrackets.normal,
							),
						);
					}
				}
				else {
					codes.push('{}');
				}
				codes.push(')');
				codes.push([
					'',
					'template',
					prop.loc.end.offset,
					caps_diagnosticOnly,
				]);
				codes.push(', ');
			}
			else if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {

				let attrNameText = prop.name;

				if (
					vueCompilerOptions.dataAttributes.some(pattern => minimatch(attrNameText!, pattern))
					|| (attrNameText === 'style' && ++styleAttrNum >= 2)
					|| (attrNameText === 'class' && ++classAttrNum >= 2)
					|| (attrNameText === 'name' && node.tag === 'slot') // #2308
				) {
					continue;
				}

				let camelized = false;

				if (
					hyphenate(prop.name) === prop.name
					&& !vueCompilerOptions.htmlAttributes.some(pattern => minimatch(attrNameText!, pattern))
				) {
					attrNameText = camelize(prop.name);
					camelized = true;
				}

				// camelize name
				codes.push([
					'',
					'template',
					prop.loc.start.offset,
					caps_diagnosticOnly,
				]);
				codes.push(
					...createObjectPropertyCode([
						attrNameText,
						'template',
						[prop.loc.start.offset, prop.loc.start.offset + prop.name.length],
						{
							...caps_attr,
							rename: {
								normalize: camelize,
								apply: camelized ? hyphenate : noEditApply,
							},
						},
					], (prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}))
				);
				codes.push(': (');
				if (prop.value) {
					generateAttrValue(prop.value);
				}
				else {
					codes.push('true');
				}
				codes.push(')');
				codes.push([
					'',
					'template',
					prop.loc.end.offset,
					caps_diagnosticOnly,
				]);
				codes.push(', ');
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& !prop.arg
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				codes.push(
					'...',
					...createInterpolationCode(
						prop.exp.content,
						prop.exp.loc,
						prop.exp.loc.start.offset,
						caps_all,
						'(',
						')',
					),
					', ',
				);
				if (mode === 'normal') {
					formatCodes.push(
						...createFormatCode(
							prop.exp.content,
							prop.exp.loc.start.offset,
							formatBrackets.normal,
						),
					);
				}
			}
			else {
				// comment this line to avoid affecting comments in prop expressions
				// tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */ ");
			}
		}

		return codes;

		function generateAttrValue(attrNode: CompilerDOM.TextNode) {
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
				caps_all,
			]);
			codes.push(char);
		}
	}

	function generateInlineCss(props: CompilerDOM.ElementNode['props']) {
		for (const prop of props) {
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

				cssCodes.push(`x { `);
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

	function generateDirectives(node: CompilerDOM.ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name !== 'slot'
				&& prop.name !== 'on'
				&& prop.name !== 'model'
				&& prop.name !== 'bind'
				&& (prop.name !== 'scope' && prop.name !== 'data')
			) {

				identifiers.add(camelize('v-' + prop.name));

				if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && !prop.arg.isStatic) {
					codes.push(
						...createInterpolationCode(
							prop.arg.content,
							prop.arg.loc,
							prop.arg.loc.start.offset + prop.arg.loc.source.indexOf(prop.arg.content),
							capabilitiesPresets.all,
							'(',
							')',
						),
						';\n',
					);
					formatCodes.push(
						...createFormatCode(
							prop.arg.content,
							prop.arg.loc.start.offset,
							formatBrackets.normal,
						),
					);
				}

				codes.push(
					[
						'',
						'template',
						prop.loc.start.offset,
						capabilitiesPresets.diagnosticOnly,
					],
					`__VLS_directiveFunction(__VLS_ctx.`,
					[
						camelize('v-' + prop.name),
						'template',
						[prop.loc.start.offset, prop.loc.start.offset + 'v-'.length + prop.name.length],
						{
							...capabilitiesPresets.noDiagnostic,
							completion: {
								// fix https://github.com/vuejs/language-tools/issues/1905
								additional: true,
							},
							rename: {
								normalize: camelize,
								apply: getRenameApply(prop.name),
							},
						},
					],
					')',
					'(',
				);
				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					codes.push(
						['', 'template', prop.exp.loc.start.offset, capabilitiesPresets.diagnosticOnly],
						...createInterpolationCode(
							prop.exp.content,
							prop.exp.loc,
							prop.exp.loc.start.offset,
							capabilitiesPresets.all,
							'(',
							')',
						),
						['', 'template', prop.exp.loc.end.offset, capabilitiesPresets.diagnosticOnly],
					);
					formatCodes.push(
						...createFormatCode(
							prop.exp.content,
							prop.exp.loc.start.offset,
							formatBrackets.normal,
						),
					);
				}
				else {
					codes.push('undefined');
				}
				codes.push(
					')',
					['', 'template', prop.loc.end.offset, capabilitiesPresets.diagnosticOnly],
					';\n',
				);
			}
		}
	}

	function generateElReferences(node: CompilerDOM.ElementNode) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				&& prop.name === 'ref'
				&& prop.value
			) {
				codes.push(
					'// @ts-ignore\n',
					...createInterpolationCode(
						prop.value.content,
						prop.value.loc,
						prop.value.loc.start.offset + 1,
						capabilitiesPresets.refAttr,
						'(',
						')',
					),
					';\n',
				);
			}
		}
	}

	function generateClassScoped(node: CompilerDOM.ElementNode) {
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

	function generateSlot(node: CompilerDOM.ElementNode, startTagOffset: number) {

		const varSlot = `__VLS_${elementIndex++}`;
		const slotNameExpNode = getSlotNameExpNode();

		if (hasScriptSetupSlots) {
			codes.push(
				'__VLS_normalizeSlot(',
				['', 'template', node.loc.start.offset, capabilitiesPresets.diagnosticOnly],
				'__VLS_slots[',
				['', 'template', node.loc.start.offset, capabilitiesPresets.diagnosticOnly],
				slotNameExpNode?.content ?? `('${getSlotName()}' as const)`,
				['', 'template', node.loc.end.offset, capabilitiesPresets.diagnosticOnly],
				']',
				['', 'template', node.loc.end.offset, capabilitiesPresets.diagnosticOnly],
				')?.(',
				['', 'template', startTagOffset, capabilitiesPresets.diagnosticOnly],
				'{\n',
			);
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
				codes.push(
					'...',
					...createInterpolationCode(
						prop.exp.content,
						prop.exp.loc,
						prop.exp.loc.start.offset,
						capabilitiesPresets.attrReference,
						'(',
						')',
					),
					',\n',
				);
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content !== 'name'
			) {
				codes.push(
					...createObjectPropertyCode([
						prop.arg.content,
						'template',
						[prop.arg.loc.start.offset, prop.arg.loc.end.offset],
						{
							...capabilitiesPresets.slotProp,
							rename: {
								normalize: camelize,
								apply: getRenameApply(prop.arg.content),
							},
						},
					], prop.arg.loc),
					': ',
					...createInterpolationCode(
						prop.exp.content,
						prop.exp.loc,
						prop.exp.loc.start.offset,
						capabilitiesPresets.attrReference,
						'(',
						')',
					),
					',\n',
				);
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				&& prop.name !== 'name' // slot name
			) {
				codes.push(
					...createObjectPropertyCode([
						prop.name,
						'template',
						prop.loc.start.offset,
						{
							...capabilitiesPresets.attr,
							rename: {
								normalize: camelize,
								apply: getRenameApply(prop.name),
							},
						},
					], prop.loc),
					': (',
					prop.value !== undefined ? `"${toUnicodeIfNeed(prop.value.content)}"` : 'true',
					'),\n',
				);
			}
		}
		codes.push(
			'}',
			hasScriptSetupSlots ? ['', 'template', startTagOffset + node.tag.length, capabilitiesPresets.diagnosticOnly] : '',
			hasScriptSetupSlots ? `);\n` : `;\n`
		);

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
				codes.push(
					...createInterpolationCode(
						slotNameExpNode.content,
						slotNameExpNode,
						undefined, undefined,
						'(',
						')',
					),
				);
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
		}
	}

	function generateAutoImportCompletionCode() {

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

	// functional like

	function createFormatCode(mapCode: string, sourceOffset: number, formatWrapper: [string, string]): Code[] {
		return [
			formatWrapper[0],
			[mapCode, 'template', sourceOffset, { completion: true /* fix vue-autoinsert-parentheses not working */ }],
			formatWrapper[1],
			'\n',
		];
	}

	function createObjectPropertyCode(a: Code, astHolder?: any): Code[] {
		const aStr = typeof a === 'string' ? a : a[0];
		if (validTsVarReg.test(aStr)) {
			return [a];
		}
		else if (aStr.startsWith('[') && aStr.endsWith(']') && astHolder) {
			const range = typeof a === 'object' ? a[2] : undefined;
			const data = typeof a === 'object' ? a[3] : undefined;
			return createInterpolationCode(
				aStr,
				astHolder,
				range && typeof range === 'object' ? range[0] : range,
				data,
				'',
				'',
			);
		}
		else {
			return createStringLiteralKeyCode(a);
		}
	}

	function createInterpolationCode(
		_code: string,
		astHolder: any,
		start: number | undefined,
		data: FileRangeCapabilities | (() => FileRangeCapabilities) | undefined,
		prefix: string,
		suffix: string,
	): Code[] {
		const code = prefix + _code + suffix;
		const ast = createTsAst(astHolder, code);
		const codes: Code[] = [];
		const vars = walkInterpolationFragment(ts, code, ast, (frag, fragOffset, isJustForErrorMapping) => {
			if (fragOffset === undefined) {
				codes.push(frag);
			}
			else {
				fragOffset -= prefix.length;
				let addSuffix = '';
				const overLength = fragOffset + frag.length - _code.length;
				if (overLength > 0) {
					addSuffix = frag.substring(frag.length - overLength);
					frag = frag.substring(0, frag.length - overLength);
				}
				if (fragOffset < 0) {
					codes.push(frag.substring(0, -fragOffset));
					frag = frag.substring(-fragOffset);
					fragOffset = 0;
				}
				if (start !== undefined && data !== undefined) {
					codes.push([
						frag,
						'template',
						start + fragOffset,
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
		if (start !== undefined) {
			for (const v of vars) {
				v.offset = start + v.offset - prefix.length;
			}
			if (vars.length) {
				tempVars.push(vars);
			}
		}
		return codes;
	}

	function createTsAst(astHolder: any, text: string) {
		if (astHolder.__volar_ast_text !== text) {
			astHolder.__volar_ast_text = text;
			astHolder.__volar_ast = ts.createSourceFile('/a.ts', text, ts.ScriptTarget.ESNext);
		}
		return astHolder.__volar_ast as ts.SourceFile;
	}

	function createPropertyAccessCode(a: Code, astHolder?: any): Code[] {
		const aStr = typeof a === 'string' ? a : a[0];
		if (!compilerOptions.noPropertyAccessFromIndexSignature && validTsVarReg.test(aStr)) {
			return ['.', a];
		}
		else if (aStr.startsWith('[') && aStr.endsWith(']')) {
			if (typeof a === 'string' || !astHolder) {
				return [a];
			}
			else {
				return createInterpolationCode(
					a[0],
					astHolder,
					typeof a[2] === 'number' ? a[2] : a[2][0],
					a[3],
					'',
					'',
				);
			}
		}
		else {
			return ['[', ...createStringLiteralKeyCode(a), ']'];
		}
	}

	function createStringLiteralKeyCode(a: Code): Code[] {
		let codes: Code[] = ['"', a, '"'];
		if (typeof a === 'object') {
			const start = typeof a[2] === 'number' ? a[2] : a[2][0];
			const end = typeof a[2] === 'number' ? a[2] : a[2][1];
			codes = [
				['', 'template', start, a[3]],
				...codes,
				['', 'template', end, a[3]],
			];
		}
		return codes;
	}
};

export function walkElementNodes(node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode, cb: (node: CompilerDOM.ElementNode) => void) {
	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		for (const child of node.children) {
			walkElementNodes(child, cb);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		const patchForNode = getVForNode(node);
		if (patchForNode) {
			walkElementNodes(patchForNode, cb);
		}
		else {
			cb(node);
			for (const child of node.children) {
				walkElementNodes(child, cb);
			}
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
function getVForNode(node: CompilerDOM.ElementNode) {
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

function getVIfNode(node: CompilerDOM.ElementNode) {
	const forDirective = node.props.find(
		(prop): prop is CompilerDOM.DirectiveNode =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'if'
	);
	if (forDirective) {
		let ifNode: CompilerDOM.IfNode | undefined;
		CompilerDOM.processIf(node, forDirective, transformContext, _ifNode => {
			ifNode = { ..._ifNode };
			return undefined;
		});
		if (ifNode) {
			for (const branch of ifNode.branches) {
				branch.children = [{
					...node,
					props: node.props.filter(prop => prop !== forDirective),
				}];
			}
			return ifNode;
		}
	}
}

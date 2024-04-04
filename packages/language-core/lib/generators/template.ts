import { toString } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import { minimatch } from 'minimatch';
import type * as ts from 'typescript';
import type { Code, CodeAndStack, Sfc, VueCodeInformation, VueCompilerOptions } from '../types';
import { hyphenateAttr, hyphenateTag } from '../utils/shared';
import { collectVars, eachInterpolationSegment } from '../utils/transform';
import { disableAllFeatures, enableAllFeatures, getStack, mergeFeatureSettings } from './utils';

const presetInfos = {
	disabledAll: disableAllFeatures({}),
	all: enableAllFeatures({}),
	allWithHiddenParam: enableAllFeatures({
		__hint: {
			setting: 'vue.inlayHints.inlineHandlerLeading',
			label: '$event =>',
			tooltip: [
				'`$event` is a hidden parameter, you can use it in this callback.',
				'To hide this hint, set `vue.inlayHints.inlineHandlerLeading` to `false` in IDE settings.',
				'[More info](https://github.com/vuejs/language-tools/issues/2445#issuecomment-1444771420)',
			].join('\n\n'),
			paddingRight: true,
		}
	}),
	noDiagnostics: enableAllFeatures({ verification: false }),
	diagnosticOnly: disableAllFeatures({ verification: true }),
	tagHover: disableAllFeatures({ semantic: { shouldHighlight: () => false } }),
	event: disableAllFeatures({ semantic: { shouldHighlight: () => false }, verification: true }),
	tagReference: disableAllFeatures({ navigation: { shouldRename: () => false } }),
	attr: disableAllFeatures({ semantic: { shouldHighlight: () => false }, verification: true, navigation: true }),
	attrReference: disableAllFeatures({ navigation: true }),
	slotProp: disableAllFeatures({ navigation: true, verification: true }),
	scopedClassName: disableAllFeatures({ navigation: true, completion: true }),
	slotName: disableAllFeatures({ semantic: { shouldHighlight: () => false }, verification: true, navigation: true, completion: true }),
	slotNameExport: disableAllFeatures({ semantic: { shouldHighlight: () => false }, verification: true, navigation: true, /* __navigationCodeLens: true */ }),
	refAttr: disableAllFeatures({ navigation: true }),
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

export function* generate(
	ts: typeof import('typescript'),
	compilerOptions: ts.CompilerOptions,
	vueCompilerOptions: VueCompilerOptions,
	template: NonNullable<Sfc['template']>,
	shouldGenerateScopedClasses: boolean,
	stylesScopedClasses: Set<string>,
	hasScriptSetupSlots: boolean,
	slotsAssignName: string | undefined,
	propsAssignName: string | undefined,
	codegenStack: boolean,
) {

	const processDirectiveComment = (code: Code) => {
		if (typeof code !== 'string') {
			if (ignoreError) {
				const data = code[3];
				if (data.verification) {
					code[3] = {
						...data,
						verification: false,
					};
				}
			}
			if (expectErrorToken) {
				const token = expectErrorToken;
				const data = code[3];
				if (data.verification) {
					code[3] = {
						...data,
						verification: {
							shouldReport: () => {
								token.errors++;
								return false;
							},
						},
					};
				}
			}
			code[3].structure = false;
			code[3].format = false;
		}
		return code;
	};
	const _ts = codegenStack
		? (code: Code): CodeAndStack => [processDirectiveComment(code), getStack()]
		: (code: Code): CodeAndStack => [processDirectiveComment(code), ''];
	const nativeTags = new Set(vueCompilerOptions.nativeTags);
	const slots = new Map<string, {
		name?: string;
		loc?: number;
		tagRange: [number, number];
		varName: string;
		nodeLoc: any;
	}>();
	const slotExps = new Map<string, { varName: string; }>();
	const tagOffsetsMap = collectTagOffsets();
	const localVars = new Map<string, number>();
	const tempVars: {
		text: string,
		isShorthand: boolean,
		offset: number,
	}[][] = [];
	const accessedGlobalVariables = new Set<string>();
	const scopedClasses: { className: string, offset: number; }[] = [];
	const blockConditions: string[] = [];
	const hasSlotElements = new Set<CompilerDOM.ElementNode>();
	const usedComponentCtxVars = new Set<string>();

	let hasSlot = false;
	let ignoreError = false;
	let expectErrorToken: { errors: number; } | undefined;
	let expectedErrorNode: CompilerDOM.CommentNode | undefined;
	let elementIndex = 0;

	if (slotsAssignName) {
		localVars.set(slotsAssignName, 1);
	}

	if (propsAssignName) {
		localVars.set(propsAssignName, 1);
	}

	yield* generatePreResolveComponents();

	if (template.ast) {
		yield* generateAstNode(template.ast, undefined, undefined, undefined);
	}

	yield* generateStyleScopedClasses();

	if (!hasScriptSetupSlots) {
		yield _ts('var __VLS_slots!:');
		yield* generateSlotsType();
		yield _ts(';\n');
	}

	yield* generateExtraAutoImport();

	return {
		tagOffsetsMap,
		accessedGlobalVariables,
		hasSlot,
	};

	function collectTagOffsets() {

		const tagOffsetsMap = new Map<string, number[]>();

		if (!template.ast) {
			return tagOffsetsMap;
		}

		for (const node of forEachElementNode(template.ast)) {
			if (node.tag === 'slot') {
				// ignore
			}
			else if (node.tag === 'component' || node.tag === 'Component') {
				for (const prop of node.props) {
					if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop.name === 'is' && prop.value) {
						const tag = prop.value.content;
						let offsets = tagOffsetsMap.get(tag);
						if (!offsets) {
							tagOffsetsMap.set(tag, offsets = []);
						}
						offsets.push(prop.value.loc.start.offset + prop.value.loc.source.lastIndexOf(tag));
						break;
					}
				}
			}
			else {
				let offsets = tagOffsetsMap.get(node.tag);
				if (!offsets) {
					tagOffsetsMap.set(node.tag, offsets = []);
				}
				const source = template.content.substring(node.loc.start.offset);
				const startTagOffset = node.loc.start.offset + source.indexOf(node.tag);

				offsets.push(startTagOffset); // start tag
				if (!node.isSelfClosing && template.lang === 'html') {
					const endTagOffset = node.loc.start.offset + node.loc.source.lastIndexOf(node.tag);
					if (endTagOffset !== startTagOffset) {
						offsets.push(endTagOffset); // end tag
					}
				}
			}
		}

		return tagOffsetsMap;
	}

	function* generateExpectErrorComment(): Generator<CodeAndStack> {

		if (expectErrorToken && expectedErrorNode) {
			const token = expectErrorToken;
			yield _ts([
				'',
				'template',
				expectedErrorNode.loc.start.offset,
				disableAllFeatures({
					verification: {
						shouldReport: () => token.errors === 0,
					},
				}),
			]);
			yield _ts('// @ts-expect-error __VLS_TS_EXPECT_ERROR');
			yield _ts([
				'',
				'template',
				expectedErrorNode.loc.end.offset,
				disableAllFeatures({ __combineLastMapping: true }),
			]);
			yield _ts('\n;\n');
		}

		ignoreError = false;
		expectErrorToken = undefined;
		expectedErrorNode = undefined;
	}

	function* generateCanonicalComponentName(tagText: string, offset: number, info: VueCodeInformation): Generator<CodeAndStack> {
		if (validTsVarReg.test(tagText)) {
			yield _ts([tagText, 'template', offset, info]);
		}
		else {
			yield* generateCamelized(
				capitalize(tagText.replace(colonReg, '-')),
				offset,
				info
			);
		}
	}

	function* generateSlotsType(): Generator<CodeAndStack> {
		for (const [exp, slot] of slotExps) {
			hasSlot = true;
			yield _ts(`Partial<Record<NonNullable<typeof ${exp}>, (_: typeof ${slot.varName}) => any>> &\n`);
		}
		yield _ts(`{\n`);
		for (const [_, slot] of slots) {
			hasSlot = true;
			if (slot.name && slot.loc !== undefined) {
				yield* generateObjectProperty(
					slot.name,
					slot.loc,
					mergeFeatureSettings(presetInfos.slotNameExport, disableAllFeatures({ __referencesCodeLens: true })),
					slot.nodeLoc
				);
			}
			else {
				yield _ts(['', 'template', slot.tagRange[0], mergeFeatureSettings(presetInfos.slotNameExport, disableAllFeatures({ __referencesCodeLens: true }))]);
				yield _ts('default');
				yield _ts(['', 'template', slot.tagRange[1], disableAllFeatures({ __combineLastMapping: true })]);
			}
			yield _ts(`?(_: typeof ${slot.varName}): any,\n`);
		}
		yield _ts(`}`);
	}

	function* generateStyleScopedClasses(): Generator<CodeAndStack> {
		yield _ts(`if (typeof __VLS_styleScopedClasses === 'object' && !Array.isArray(__VLS_styleScopedClasses)) {\n`);
		for (const { className, offset } of scopedClasses) {
			yield _ts(`__VLS_styleScopedClasses[`);
			yield* generateStringLiteralKey(
				className,
				offset,
				mergeFeatureSettings(
					presetInfos.scopedClassName,
					disableAllFeatures({ __displayWithLink: stylesScopedClasses.has(className) }),
				),
			);
			yield _ts(`];\n`);
		}
		yield _ts('}\n');
	}

	function* generatePreResolveComponents(): Generator<CodeAndStack> {

		yield _ts(`let __VLS_resolvedLocalAndGlobalComponents!: {}\n`);

		for (const [tagName] of tagOffsetsMap) {

			if (nativeTags.has(tagName)) {
				continue;
			}

			const isNamespacedTag = tagName.indexOf('.') >= 0;
			if (isNamespacedTag) {
				continue;
			}

			yield _ts(`& __VLS_WithComponent<'${getCanonicalComponentName(tagName)}', typeof __VLS_localComponents, `);
			// order is important: https://github.com/vuejs/language-tools/issues/2010
			yield _ts(`"${capitalize(camelize(tagName))}", `);
			yield _ts(`"${camelize(tagName)}", `);
			yield _ts(`"${tagName}"`);
			yield _ts('>\n');
		}

		yield _ts(`;\n`);

		for (const [tagName, tagOffsets] of tagOffsetsMap) {

			for (const tagOffset of tagOffsets) {
				if (nativeTags.has(tagName)) {
					yield _ts(`__VLS_intrinsicElements`);
					yield* generatePropertyAccess(
						tagName,
						tagOffset,
						mergeFeatureSettings(
							presetInfos.tagReference,
							{
								navigation: true
							},
							...[
								presetInfos.tagHover,
								presetInfos.diagnosticOnly,
							],
						),
					);
					yield _ts(';');
				}
				else if (validTsVarReg.test(camelize(tagName))) {
					for (const shouldCapitalize of tagName[0] === tagName.toUpperCase() ? [false] : [true, false]) {
						const expectName = shouldCapitalize ? capitalize(camelize(tagName)) : camelize(tagName);
						yield _ts('__VLS_components.');
						yield* generateCamelized(
							shouldCapitalize ? capitalize(tagName) : tagName,
							tagOffset,
							mergeFeatureSettings(
								presetInfos.tagReference,
								{
									navigation: {
										resolveRenameNewName: tagName !== expectName ? camelizeComponentName : undefined,
										resolveRenameEditText: getTagRenameApply(tagName),
									}
								},
							),
						);
						yield _ts(';');
					}
				}
			}
			yield _ts('\n');

			if (
				!nativeTags.has(tagName)
				&& validTsVarReg.test(camelize(tagName))
			) {
				yield _ts('// @ts-ignore\n'); // #2304
				yield _ts('[');
				for (const tagOffset of tagOffsets) {
					yield* generateCamelized(
						capitalize(tagName),
						tagOffset,
						disableAllFeatures({
							completion: {
								isAdditional: true,
								onlyImport: true,
							},
						}),
					);
					yield _ts(',');
				}
				yield _ts(`];\n`);
			}
		}
	}

	function* generateAstNode(
		node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode | CompilerDOM.InterpolationNode | CompilerDOM.CompoundExpressionNode | CompilerDOM.TextNode | CompilerDOM.SimpleExpressionNode,
		parentEl: CompilerDOM.ElementNode | undefined,
		prevNode: CompilerDOM.TemplateChildNode | undefined,
		componentCtxVar: string | undefined,
	): Generator<CodeAndStack> {

		yield* generateExpectErrorComment();

		if (prevNode?.type === CompilerDOM.NodeTypes.COMMENT) {
			const commentText = prevNode.content.trim().split(' ')[0];
			if (commentText.match(/^@vue-skip\b[\s\S]*/)) {
				return;
			}
			else if (commentText.match(/^@vue-ignore\b[\s\S]*/)) {
				ignoreError = true;
			}
			else if (commentText.match(/^@vue-expect-error\b[\s\S]*/)) {
				expectErrorToken = { errors: 0 };
				expectedErrorNode = prevNode;
			}
		}

		if (node.type === CompilerDOM.NodeTypes.ROOT) {
			let prev: CompilerDOM.TemplateChildNode | undefined;
			for (const childNode of node.children) {
				yield* generateAstNode(childNode, parentEl, prev, componentCtxVar);
				prev = childNode;
			}
			yield* generateExpectErrorComment();
		}
		else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
			const vForNode = getVForNode(node);
			const vIfNode = getVIfNode(node);
			if (vForNode) {
				yield* generateVFor(vForNode, parentEl, componentCtxVar);
			}
			else if (vIfNode) {
				yield* generateVIf(vIfNode, parentEl, componentCtxVar);
			}
			else {
				yield* generateElement(node, parentEl, componentCtxVar);
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.TEXT_CALL) {
			// {{ var }}
			yield* generateAstNode(node.content, parentEl, undefined, componentCtxVar);
		}
		else if (node.type === CompilerDOM.NodeTypes.COMPOUND_EXPRESSION) {
			// {{ ... }} {{ ... }}
			for (const childNode of node.children) {
				if (typeof childNode === 'object') {
					yield* generateAstNode(childNode, parentEl, undefined, componentCtxVar);
				}
			}
		}
		else if (node.type === CompilerDOM.NodeTypes.INTERPOLATION) {
			// {{ ... }}
			const [content, start] = parseInterpolationNode(node, template.content);
			yield* generateInterpolation(
				content,
				node.content.loc,
				start,
				presetInfos.all,
				'(',
				');\n',
			);
		}
		else if (node.type === CompilerDOM.NodeTypes.IF) {
			// v-if / v-else-if / v-else
			yield* generateVIf(node, parentEl, componentCtxVar);
		}
		else if (node.type === CompilerDOM.NodeTypes.FOR) {
			// v-for
			yield* generateVFor(node, parentEl, componentCtxVar);
		}
		else if (node.type === CompilerDOM.NodeTypes.TEXT) {
			// not needed progress
		}
	}

	function* generateVIf(node: CompilerDOM.IfNode, parentEl: CompilerDOM.ElementNode | undefined, componentCtxVar: string | undefined): Generator<CodeAndStack> {

		let originalBlockConditionsLength = blockConditions.length;

		for (let i = 0; i < node.branches.length; i++) {

			const branch = node.branches[i];

			if (i === 0) {
				yield _ts('if');
			}
			else if (branch.condition) {
				yield _ts('else if');
			}
			else {
				yield _ts('else');
			}

			let addedBlockCondition = false;

			if (branch.condition?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				yield _ts(` `);
				yield* generateInterpolation(
					branch.condition.content,
					branch.condition.loc,
					branch.condition.loc.start.offset,
					presetInfos.all,
					'(',
					')',
				);
				blockConditions.push(
					toString(
						[...generateInterpolation(branch.condition.content, branch.condition.loc, undefined, undefined, '(', ')')]
							.map(([code]) => code)
					)
				);
				addedBlockCondition = true;
			}

			yield _ts(` {\n`);

			let prev: CompilerDOM.TemplateChildNode | undefined;
			for (const childNode of branch.children) {
				yield* generateAstNode(childNode, parentEl, prev, componentCtxVar);
				prev = childNode;
			}
			yield* generateExpectErrorComment();

			yield* generateExtraAutoImport();
			yield _ts('}\n');

			if (addedBlockCondition) {
				blockConditions[blockConditions.length - 1] = `!(${blockConditions[blockConditions.length - 1]})`;
			}
		}

		blockConditions.length = originalBlockConditionsLength;
	}

	function* generateVFor(node: CompilerDOM.ForNode, parentEl: CompilerDOM.ElementNode | undefined, componentCtxVar: string | undefined): Generator<CodeAndStack> {
		const { source } = node.parseResult;
		const { leftExpressionRange, leftExpressionText } = parseVForNode(node);
		const forBlockVars: string[] = [];

		yield _ts(`for (const [`);
		if (leftExpressionRange && leftExpressionText) {

			const collectAst = createTsAst(ts, node.parseResult, `const [${leftExpressionText}]`);
			collectVars(ts, collectAst, collectAst, forBlockVars);

			for (const varName of forBlockVars) {
				localVars.set(varName, (localVars.get(varName) ?? 0) + 1);
			}

			yield _ts([leftExpressionText, 'template', leftExpressionRange.start, presetInfos.all]);
		}
		yield _ts(`] of __VLS_getVForSourceType`);
		if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			yield _ts('(');
			yield* generateInterpolation(
				source.content,
				source.loc,
				source.loc.start.offset,
				presetInfos.all,
				'(',
				')',
			);
			yield _ts('!)'); // #3102
			yield _ts(') {\n');

			let prev: CompilerDOM.TemplateChildNode | undefined;
			for (const childNode of node.children) {
				yield* generateAstNode(childNode, parentEl, prev, componentCtxVar);
				prev = childNode;
			}
			yield* generateExpectErrorComment();

			yield* generateExtraAutoImport();
			yield _ts('}\n');
		}

		for (const varName of forBlockVars) {
			localVars.set(varName, localVars.get(varName)! - 1);
		}
	}

	function* generateElement(node: CompilerDOM.ElementNode, parentEl: CompilerDOM.ElementNode | undefined, componentCtxVar: string | undefined): Generator<CodeAndStack> {

		yield _ts(`{\n`);

		const startTagOffset = node.loc.start.offset + template.content.substring(node.loc.start.offset).indexOf(node.tag);
		let endTagOffset = !node.isSelfClosing && template.lang === 'html' ? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) : undefined;

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
			yield _ts('const ');
			yield _ts(var_originalComponent);
			yield _ts(` = __VLS_intrinsicElements[`);
			yield* generateStringLiteralKey(
				tag,
				tagOffsets[0],
				presetInfos.diagnosticOnly,
			);
			yield _ts('];\n');
		}
		else if (isNamespacedTag) {
			yield _ts(`const ${var_originalComponent} = `);
			yield* generateInterpolation(tag, node.loc, startTagOffset, presetInfos.all, '', '');
			yield _ts(';\n');
		}
		else if (dynamicTagExp) {
			yield _ts(`const ${var_originalComponent} = `);
			yield* generateInterpolation(dynamicTagExp.loc.source, dynamicTagExp.loc, dynamicTagExp.loc.start.offset, presetInfos.all, '(', ')');
			yield _ts(';\n');
		}
		else {
			yield _ts(`const ${var_originalComponent} = ({} as `);
			for (const componentName of getPossibleOriginalComponentNames(tag)) {
				yield _ts(`'${componentName}' extends keyof typeof __VLS_ctx ? `);
				yield _ts(`{ '${getCanonicalComponentName(tag)}': typeof __VLS_ctx`);
				yield* generatePropertyAccess(componentName);
				yield _ts(` }: `);
			}
			yield _ts(`typeof __VLS_resolvedLocalAndGlobalComponents)`);
			if (tagOffsets.length) {
				yield* generatePropertyAccess(
					getCanonicalComponentName(tag),
					tagOffsets[0],
					presetInfos.diagnosticOnly,
				);
			}
			else {
				yield* generatePropertyAccess(getCanonicalComponentName(tag));
			}
			yield _ts(';\n');
		}

		if (isIntrinsicElement) {
			yield _ts(`const ${var_functionalComponent} = __VLS_elementAsFunctionalComponent(${var_originalComponent});\n`);
		}
		else {
			yield _ts(`const ${var_functionalComponent} = __VLS_asFunctionalComponent(`);
			yield _ts(`${var_originalComponent}, `);
			yield _ts(`new ${var_originalComponent}({`);
			yield* generateProps(node, props, 'extraReferences');
			yield _ts('})');
			yield _ts(');\n');
		}

		for (const offset of tagOffsets) {
			if (isNamespacedTag || dynamicTagExp || isIntrinsicElement) {
				continue;
			}
			yield _ts(`({} as { ${getCanonicalComponentName(tag)}: typeof ${var_originalComponent} }).`);
			yield* generateCanonicalComponentName(
				tag,
				offset,
				mergeFeatureSettings(
					presetInfos.tagHover,
					presetInfos.diagnosticOnly,
				),
			);
			yield _ts(';\n');
		}

		if (vueCompilerOptions.strictTemplates) {
			// with strictTemplates, generate once for props type-checking + instance type
			yield _ts(`const ${var_componentInstance} = ${var_functionalComponent}(`);
			// diagnostic start
			yield _ts(
				tagOffsets.length ? ['', 'template', tagOffsets[0], presetInfos.diagnosticOnly]
					: dynamicTagExp ? ['', 'template', startTagOffset, presetInfos.diagnosticOnly]
						: ''
			);
			yield _ts('{ ');
			yield* generateProps(node, props, 'normal', propsFailedExps);
			yield _ts('}');
			// diagnostic end
			yield _ts(
				tagOffsets.length ? ['', 'template', tagOffsets[0] + tag.length, presetInfos.diagnosticOnly]
					: dynamicTagExp ? ['', 'template', startTagOffset + tag.length, presetInfos.diagnosticOnly]
						: ''
			);
			yield _ts(`, ...__VLS_functionalComponentArgsRest(${var_functionalComponent}));\n`);
		}
		else {
			// without strictTemplates, this only for instacne type
			yield _ts(`const ${var_componentInstance} = ${var_functionalComponent}(`);
			yield _ts('{ ');
			yield* generateProps(node, props, 'extraReferences');
			yield _ts('}');
			yield _ts(`, ...__VLS_functionalComponentArgsRest(${var_functionalComponent}));\n`);
			// and this for props type-checking
			yield _ts(`({} as (props: __VLS_FunctionalComponentProps<typeof ${var_originalComponent}, typeof ${var_componentInstance}> & Record<string, unknown>) => void)(`);
			// diagnostic start
			yield _ts(
				tagOffsets.length ? ['', 'template', tagOffsets[0], presetInfos.diagnosticOnly]
					: dynamicTagExp ? ['', 'template', startTagOffset, presetInfos.diagnosticOnly]
						: ''
			);
			yield _ts('{ ');
			yield* generateProps(node, props, 'normal', propsFailedExps);
			yield _ts('}');
			// diagnostic end
			yield _ts(
				tagOffsets.length ? ['', 'template', tagOffsets[0] + tag.length, presetInfos.diagnosticOnly]
					: dynamicTagExp ? ['', 'template', startTagOffset + tag.length, presetInfos.diagnosticOnly]
						: ''
			);
			yield _ts(`);\n`);
		}

		let defineComponentCtxVar: string | undefined;

		if (tag !== 'template' && tag !== 'slot') {
			defineComponentCtxVar = `__VLS_${elementIndex++}`;
			componentCtxVar = defineComponentCtxVar;
			parentEl = node;
		}

		const componentEventsVar = `__VLS_${elementIndex++}`;

		let usedComponentEventsVar = false;

		//#region
		// fix https://github.com/vuejs/language-tools/issues/1775
		for (const failedExp of propsFailedExps) {
			yield* generateInterpolation(
				failedExp.loc.source,
				failedExp.loc,
				failedExp.loc.start.offset,
				presetInfos.all,
				'(',
				')',
			);
			yield _ts(';\n');
		}

		const vScope = props.find(prop => prop.type === CompilerDOM.NodeTypes.DIRECTIVE && (prop.name === 'scope' || prop.name === 'data'));
		let inScope = false;
		let originalConditionsNum = blockConditions.length;

		if (vScope?.type === CompilerDOM.NodeTypes.DIRECTIVE && vScope.exp) {

			const scopeVar = `__VLS_${elementIndex++}`;
			const condition = `__VLS_withScope(__VLS_ctx, ${scopeVar})`;

			yield _ts(`const ${scopeVar} = `);
			yield _ts([
				vScope.exp.loc.source,
				'template',
				vScope.exp.loc.start.offset,
				presetInfos.all,
			]);
			yield _ts(';\n');
			yield _ts(`if (${condition}) {\n`);
			blockConditions.push(condition);
			inScope = true;
		}

		yield* generateDirectives(node);
		yield* generateReferencesForElements(node); // <el ref="foo" />
		if (shouldGenerateScopedClasses) {
			yield* generateReferencesForScopedCssClasses(node);
		}
		if (componentCtxVar) {
			usedComponentCtxVars.add(componentCtxVar);
			yield* generateEvents(node, var_functionalComponent, var_componentInstance, componentEventsVar, () => usedComponentEventsVar = true);
		}
		if (node.tag === 'slot') {
			yield* generateSlot(node, startTagOffset);
		}

		if (inScope) {
			yield _ts('}\n');
			blockConditions.length = originalConditionsNum;
		}
		//#endregion

		const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as CompilerDOM.DirectiveNode;
		if (slotDir && componentCtxVar) {
			usedComponentCtxVars.add(componentCtxVar);
			if (parentEl) {
				hasSlotElements.add(parentEl);
			}
			const slotBlockVars: string[] = [];
			yield _ts(`{\n`);
			let hasProps = false;
			if (slotDir?.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {

				const slotAst = createTsAst(ts, slotDir, `(${slotDir.exp.content}) => {}`);
				collectVars(ts, slotAst, slotAst, slotBlockVars);
				hasProps = true;
				if (slotDir.exp.content.indexOf(':') === -1) {
					yield _ts('const [');
					yield _ts([
						slotDir.exp.content,
						'template',
						slotDir.exp.loc.start.offset,
						presetInfos.all,
					]);
					yield _ts(`] = __VLS_getSlotParams(`);
				}
				else {
					yield _ts('const ');
					yield _ts([
						slotDir.exp.content,
						'template',
						slotDir.exp.loc.start.offset,
						presetInfos.all,
					]);
					yield _ts(` = __VLS_getSlotParam(`);
				}
			}
			yield _ts(['', 'template', (slotDir.arg ?? slotDir).loc.start.offset, presetInfos.diagnosticOnly]);
			yield _ts(`(${componentCtxVar}.slots!)`);
			if (slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && slotDir.arg.content) {
				yield* generatePropertyAccess(
					slotDir.arg.loc.source,
					slotDir.arg.loc.start.offset,
					slotDir.arg.isStatic ? presetInfos.slotName : presetInfos.all,
					slotDir.arg.loc
				);
			}
			else {
				yield _ts('.');
				yield _ts(['', 'template', slotDir.loc.start.offset, { ...presetInfos.slotName, completion: false }] satisfies Code);
				yield _ts('default');
				yield _ts(['', 'template', slotDir.loc.start.offset + (slotDir.loc.source.startsWith('#') ? '#'.length : slotDir.loc.source.startsWith('v-slot:') ? 'v-slot:'.length : 0), disableAllFeatures({ __combineLastMapping: true })] satisfies Code);
			}
			yield _ts(['', 'template', (slotDir.arg ?? slotDir).loc.end.offset, presetInfos.diagnosticOnly]);
			if (hasProps) {
				yield _ts(')');
			}
			yield _ts(';\n');

			slotBlockVars.forEach(varName => {
				localVars.set(varName, (localVars.get(varName) ?? 0) + 1);
			});

			let prev: CompilerDOM.TemplateChildNode | undefined;
			for (const childNode of node.children) {
				yield* generateAstNode(childNode, parentEl, prev, componentCtxVar);
				prev = childNode;
			}
			yield* generateExpectErrorComment();
			yield* generateExtraAutoImport();

			slotBlockVars.forEach(varName => {
				localVars.set(varName, localVars.get(varName)! - 1);
			});
			let isStatic = true;
			if (slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				isStatic = slotDir.arg.isStatic;
			}
			if (isStatic && slotDir && !slotDir.arg) {
				yield _ts(`${componentCtxVar}.slots!['`);
				yield _ts([
					'',
					'template',
					slotDir.loc.start.offset + (
						slotDir.loc.source.startsWith('#')
							? '#'.length : slotDir.loc.source.startsWith('v-slot:')
								? 'v-slot:'.length
								: 0
					),
					disableAllFeatures({ completion: true }),
				]);
				yield _ts(`'/* empty slot name completion */]\n`);
			}
			yield _ts(`}\n`);
		}
		else {
			let prev: CompilerDOM.TemplateChildNode | undefined;
			for (const childNode of node.children) {
				yield* generateAstNode(childNode, parentEl, prev, componentCtxVar);
				prev = childNode;
			}
			yield* generateExpectErrorComment();

			// fix https://github.com/vuejs/language-tools/issues/932
			if (!hasSlotElements.has(node) && node.children.length) {
				yield _ts(`(${componentCtxVar}.slots!).`);
				yield _ts(['', 'template', node.children[0].loc.start.offset, disableAllFeatures({ navigation: true })]);
				yield _ts('default');
				yield _ts(['', 'template', node.children[node.children.length - 1].loc.end.offset, disableAllFeatures({ __combineLastMapping: true })]);
				yield _ts(';\n');
			}
		}

		if (defineComponentCtxVar && usedComponentCtxVars.has(defineComponentCtxVar)) {
			yield _ts(`const ${componentCtxVar} = __VLS_pickFunctionalComponentCtx(${var_originalComponent}, ${var_componentInstance})!;\n`);
		}
		if (usedComponentEventsVar) {
			yield _ts(`let ${componentEventsVar}!: __VLS_NormalizeEmits<typeof ${componentCtxVar}.emit>;\n`);
		}

		yield _ts(`}\n`);
	}

	function* generateEvents(node: CompilerDOM.ElementNode, componentVar: string, componentInstanceVar: string, eventsVar: string, used: () => void): Generator<CodeAndStack> {

		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				used();
				const eventVar = `__VLS_${elementIndex++}`;
				yield _ts(`let ${eventVar} = { '${prop.arg.loc.source}': `);
				yield _ts(`__VLS_pickEvent(`);
				yield _ts(`${eventsVar}['${prop.arg.loc.source}'], `);
				yield _ts(`({} as __VLS_FunctionalComponentProps<typeof ${componentVar}, typeof ${componentInstanceVar}>)`);
				const startCode: Code = [
					'',
					'template',
					prop.arg.loc.start.offset,
					mergeFeatureSettings(
						presetInfos.attrReference,
						{
							navigation: {
								// @click-outside -> onClickOutside
								resolveRenameNewName(newName) {
									return camelize('on-' + newName);
								},
								// onClickOutside -> @click-outside
								resolveRenameEditText(newName) {
									const hName = hyphenateAttr(newName);
									if (hyphenateAttr(newName).startsWith('on-')) {
										return camelize(hName.slice('on-'.length));
									}
									return newName;
								},
							},
						},
					),
				];
				if (validTsVarReg.test(camelize(prop.arg.loc.source))) {
					yield _ts(`.`);
					yield _ts(startCode);
					yield _ts(`on`);
					yield* generateCamelized(
						capitalize(prop.arg.loc.source),
						prop.arg.loc.start.offset,
						disableAllFeatures({ __combineLastMapping: true }),
					);
				}
				else {
					yield _ts(`[`);
					yield _ts(startCode);
					yield _ts(`'`);
					yield _ts(['', 'template', prop.arg.loc.start.offset, disableAllFeatures({ __combineLastMapping: true })]);
					yield _ts('on');
					yield* generateCamelized(
						capitalize(prop.arg.loc.source),
						prop.arg.loc.start.offset,
						disableAllFeatures({ __combineLastMapping: true }),
					);
					yield _ts(`'`);
					yield _ts(['', 'template', prop.arg.loc.end.offset, disableAllFeatures({ __combineLastMapping: true })]);
					yield _ts(`]`);
				}
				yield _ts(`) };\n`);
				yield _ts(`${eventVar} = { `);
				if (prop.arg.loc.source.startsWith('[') && prop.arg.loc.source.endsWith(']')) {
					yield _ts('[(');
					yield* generateInterpolation(
						prop.arg.loc.source.slice(1, -1),
						prop.arg.loc,
						prop.arg.loc.start.offset + 1,
						presetInfos.all,
						'',
						'',
					);
					yield _ts(')!]');
				}
				else {
					yield* generateObjectProperty(
						prop.arg.loc.source,
						prop.arg.loc.start.offset,
						presetInfos.event,
						prop.arg.loc
					);
				}
				yield _ts(`: `);
				yield* appendExpressionNode(prop);
				yield _ts(` };\n`);
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				// for vue 2 nameless event
				// https://github.com/johnsoncodehk/vue-tsc/issues/67
				yield* generateInterpolation(
					prop.exp.content,
					prop.exp.loc,
					prop.exp.loc.start.offset,
					presetInfos.all,
					'$event => {(',
					')}',
				);
				yield _ts(';\n');
			}
		}
	}

	function* appendExpressionNode(prop: CompilerDOM.DirectiveNode): Generator<CodeAndStack> {
		if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			let prefix = '(';
			let suffix = ')';
			let isFirstMapping = true;

			const ast = createTsAst(ts, prop.exp, prop.exp.content);
			const _isCompoundExpression = isCompoundExpression(ts, ast);
			if (_isCompoundExpression) {

				yield _ts('$event => {\n');
				localVars.set('$event', (localVars.get('$event') ?? 0) + 1);

				prefix = '';
				suffix = '';
				for (const blockCondition of blockConditions) {
					prefix += `if (!(${blockCondition})) return;\n`;
				}
			}

			yield* generateInterpolation(
				prop.exp.content,
				prop.exp.loc,
				prop.exp.loc.start.offset,
				() => {
					if (_isCompoundExpression && isFirstMapping) {
						isFirstMapping = false;
						return presetInfos.allWithHiddenParam;
					}
					return presetInfos.all;
				},
				prefix,
				suffix,
			);

			if (_isCompoundExpression) {
				localVars.set('$event', localVars.get('$event')! - 1);

				yield _ts(';\n');
				yield* generateExtraAutoImport();
				yield _ts('}\n');
			}
		}
		else {
			yield _ts(`() => {}`);
		}
	}

	function* generateProps(node: CompilerDOM.ElementNode, props: CompilerDOM.ElementNode['props'], mode: 'normal' | 'extraReferences', propsFailedExps?: CompilerDOM.SimpleExpressionNode[]): Generator<CodeAndStack> {

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

		let caps_all: VueCodeInformation = presetInfos.all;
		let caps_diagnosticOnly: VueCodeInformation = presetInfos.diagnosticOnly;
		let caps_attr: VueCodeInformation = presetInfos.attr;

		if (mode === 'extraReferences') {
			caps_all = disableAllFeatures({ navigation: caps_all.navigation });
			caps_diagnosticOnly = disableAllFeatures({ navigation: caps_diagnosticOnly.navigation });
			caps_attr = disableAllFeatures({ navigation: caps_attr.navigation });
		}

		yield _ts(`...{ `);
		for (const prop of props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				yield _ts(`'${camelize('on-' + prop.arg.loc.source)}': {} as any, `);
			}
		}
		yield _ts(`}, `);

		const canCamelize = !nativeTags.has(node.tag) || node.tagType === CompilerDOM.ElementTypes.COMPONENT;

		for (const prop of props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& (prop.name === 'bind' || prop.name === 'model')
				&& (prop.name === 'model' || prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
				&& (!prop.exp || prop.exp.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
			) {

				let propName =
					prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
						? prop.arg.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY
							? prop.arg.content
							: prop.arg.loc.source
						: getModelValuePropName(node, vueCompilerOptions.target, vueCompilerOptions);

				if (prop.modifiers.some(m => m === 'prop' || m === 'attr')) {
					propName = propName?.substring(1);
				}

				if (
					propName === undefined
					|| vueCompilerOptions.dataAttributes.some(pattern => minimatch(propName!, pattern))
					|| (propName === 'style' && ++styleAttrNum >= 2)
					|| (propName === 'class' && ++classAttrNum >= 2)
					|| (propName === 'name' && node.tag === 'slot') // #2308
				) {
					if (prop.exp && prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
						propsFailedExps?.push(prop.exp);
					}
					continue;
				}

				const shouldCamelize = canCamelize
					&& (!prop.arg || (prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)) // isStatic
					&& hyphenateAttr(propName) === propName
					&& !vueCompilerOptions.htmlAttributes.some(pattern => minimatch(propName!, pattern));

				yield _ts(['', 'template', prop.loc.start.offset, caps_diagnosticOnly]);
				yield* generateObjectProperty(
					propName,
					prop.arg
						? prop.arg.loc.start.offset
						: prop.loc.start.offset,
					prop.arg
						? mergeFeatureSettings(
							caps_attr,
							{
								navigation: caps_attr.navigation ? {
									resolveRenameNewName: camelize,
									resolveRenameEditText: shouldCamelize ? hyphenateAttr : undefined,
								} : undefined,
							},
						)
						: caps_attr,
					(prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {}),
					shouldCamelize,
				);
				yield _ts(': (');
				if (prop.exp && prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) { // style='z-index: 2' will compile to {'z-index':'2'}
					const isShorthand = prop.arg?.loc.start.offset === prop.exp?.loc.start.offset; // vue 3.4+
					if (!isShorthand) {
						yield* generateInterpolation(
							prop.exp.loc.source,
							prop.exp.loc,
							prop.exp.loc.start.offset,
							caps_all,
							'(',
							')',
						);
					} else {
						const propVariableName = camelize(prop.exp.loc.source);

						if (validTsVarReg.test(propVariableName)) {
							if (!localVars.has(propVariableName)) {
								accessedGlobalVariables.add(propVariableName);
								yield _ts('__VLS_ctx.');
							}
							yield* generateCamelized(
								prop.exp.loc.source,
								prop.exp.loc.start.offset,
								caps_all,
							);
							if (mode === 'normal') {
								yield _ts([
									'',
									'template',
									prop.exp.loc.end.offset,
									disableAllFeatures({
										__hint: {
											setting: 'vue.inlayHints.vBindShorthand',
											label: `="${propVariableName}"`,
											tooltip: [
												`This is a shorthand for \`${prop.exp.loc.source}="${propVariableName}"\`.`,
												'To hide this hint, set `vue.inlayHints.vBindShorthand` to `false` in IDE settings.',
												'[More info](https://github.com/vuejs/core/pull/9451)',
											].join('\n\n'),
										},
									})
								]);
							}
						}
					}
				}
				else {
					yield _ts('{}');
				}
				yield _ts(')');
				yield _ts([
					'',
					'template',
					prop.loc.end.offset,
					caps_diagnosticOnly,
				]);
				yield _ts(', ');
			}
			else if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {

				if (
					vueCompilerOptions.dataAttributes.some(pattern => minimatch(prop.name, pattern))
					|| (prop.name === 'style' && ++styleAttrNum >= 2)
					|| (prop.name === 'class' && ++classAttrNum >= 2)
					|| (prop.name === 'name' && node.tag === 'slot') // #2308
				) {
					continue;
				}

				if (
					vueCompilerOptions.target < 3
					&& (node.tag === 'transition' || node.tag === 'Transition')
					&& prop.name === 'persisted'
				) {
					// Vue 2 Transition doesn't support "persisted" property but `@vue/compiler-dom always adds it (#3881)
					continue;
				}

				const shouldCamelize = canCamelize
					&& hyphenateAttr(prop.name) === prop.name
					&& !vueCompilerOptions.htmlAttributes.some(pattern => minimatch(prop.name, pattern));

				yield _ts(['', 'template', prop.loc.start.offset, caps_diagnosticOnly]);
				yield* generateObjectProperty(
					prop.name,
					prop.loc.start.offset,
					shouldCamelize
						? mergeFeatureSettings(caps_attr, {
							navigation: caps_attr.navigation ? {
								resolveRenameNewName: camelize,
								resolveRenameEditText: hyphenateAttr,
							} : undefined,
						})
						: caps_attr,
					(prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}),
					shouldCamelize,
				);
				yield _ts(': (');
				if (prop.value) {
					yield* generateAttrValue(prop.value, caps_all);
				}
				else {
					yield _ts('true');
				}
				yield _ts(')');
				yield _ts(['', 'template', prop.loc.end.offset, caps_diagnosticOnly]);
				yield _ts(', ');
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& !prop.arg
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				yield _ts(['', 'template', prop.exp.loc.start.offset, presetInfos.diagnosticOnly]);
				yield _ts('...');
				yield* generateInterpolation(
					prop.exp.content,
					prop.exp.loc,
					prop.exp.loc.start.offset,
					caps_all,
					'(',
					')',
				);
				yield _ts(['', 'template', prop.exp.loc.end.offset, presetInfos.diagnosticOnly]);
				yield _ts(', ');
			}
			else {
				// comment this line to avoid affecting comments in prop expressions
				// tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */ ");
			}
		}
	}

	function* generateDirectives(node: CompilerDOM.ElementNode): Generator<CodeAndStack> {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name !== 'slot'
				&& prop.name !== 'on'
				&& prop.name !== 'model'
				&& prop.name !== 'bind'
				&& (prop.name !== 'scope' && prop.name !== 'data')
			) {

				accessedGlobalVariables.add(camelize('v-' + prop.name));

				if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && !prop.arg.isStatic) {
					yield* generateInterpolation(
						prop.arg.content,
						prop.arg.loc,
						prop.arg.loc.start.offset + prop.arg.loc.source.indexOf(prop.arg.content),
						presetInfos.all,
						'(',
						')',
					);
					yield _ts(';\n');
				}

				yield _ts(['', 'template', prop.loc.start.offset, presetInfos.diagnosticOnly]);
				yield _ts(`__VLS_directiveFunction(__VLS_ctx.`);
				yield* generateCamelized(
					'v-' + prop.name,
					prop.loc.start.offset,
					mergeFeatureSettings(
						presetInfos.noDiagnostics,
						{
							completion: {
								// fix https://github.com/vuejs/language-tools/issues/1905
								isAdditional: true,
							},
							navigation: {
								resolveRenameNewName: camelize,
								resolveRenameEditText: getPropRenameApply(prop.name),
							},
						},
					),
				);
				yield _ts(')');
				yield _ts('(');

				if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					yield _ts(['', 'template', prop.exp.loc.start.offset, presetInfos.diagnosticOnly]);
					yield* generateInterpolation(
						prop.exp.content,
						prop.exp.loc,
						prop.exp.loc.start.offset,
						presetInfos.all,
						'(',
						')',
					);
					yield _ts(['', 'template', prop.exp.loc.end.offset, presetInfos.diagnosticOnly]);
				}
				else {
					yield _ts('undefined');
				}
				yield _ts(')');
				yield _ts(['', 'template', prop.loc.end.offset, presetInfos.diagnosticOnly]);
				yield _ts(';\n');
			}
		}
	}

	function* generateReferencesForElements(node: CompilerDOM.ElementNode): Generator<CodeAndStack> {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				&& prop.name === 'ref'
				&& prop.value
			) {
				yield _ts('// @ts-ignore\n');
				yield* generateInterpolation(
					prop.value.content,
					prop.value.loc,
					prop.value.loc.start.offset + 1,
					presetInfos.refAttr,
					'(',
					')',
				);
				yield _ts(';\n');
			}
		}
	}

	function* generateReferencesForScopedCssClasses(node: CompilerDOM.ElementNode): Generator<CodeAndStack> {
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
				yield _ts(`__VLS_styleScopedClasses = (`);
				yield _ts([
					prop.exp.content,
					'template',
					prop.exp.loc.start.offset,
					presetInfos.scopedClassName,
				]);
				yield _ts(`);\n`);
			}
		}
	}

	function* generateSlot(node: CompilerDOM.ElementNode, startTagOffset: number): Generator<CodeAndStack> {

		const varSlot = `__VLS_${elementIndex++}`;
		const slotNameExpNode = getSlotNameExpNode();

		if (hasScriptSetupSlots) {
			yield _ts('__VLS_normalizeSlot(');
			yield _ts(['', 'template', node.loc.start.offset, presetInfos.diagnosticOnly]);
			yield _ts(`${slotsAssignName ?? '__VLS_slots'}[`);
			yield _ts(['', 'template', node.loc.start.offset, disableAllFeatures({ __combineLastMapping: true })]);
			yield _ts(slotNameExpNode?.content ?? `('${getSlotName()?.[0] ?? 'default'}' as const)`);
			yield _ts(['', 'template', node.loc.end.offset, disableAllFeatures({ __combineLastMapping: true })]);
			yield _ts(']');
			yield _ts(['', 'template', node.loc.end.offset, disableAllFeatures({ __combineLastMapping: true })]);
			yield _ts(')?.(');
			yield _ts(['', 'template', startTagOffset, disableAllFeatures({ __combineLastMapping: true })]);
			yield _ts('{\n');
		}
		else {
			yield _ts(`var ${varSlot} = {\n`);
		}
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& !prop.arg
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				yield _ts('...');
				yield* generateInterpolation(
					prop.exp.content,
					prop.exp.loc,
					prop.exp.loc.start.offset,
					presetInfos.attrReference,
					'(',
					')',
				);
				yield _ts(',\n');
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.content !== 'name'
			) {
				yield* generateObjectProperty(
					prop.arg.content,
					prop.arg.loc.start.offset,
					mergeFeatureSettings(
						presetInfos.slotProp,
						{
							navigation: {
								resolveRenameNewName: camelize,
								resolveRenameEditText: getPropRenameApply(prop.arg.content),
							},
						},
					),
					prop.arg.loc
				);
				yield _ts(': ');
				yield* generateInterpolation(
					prop.exp.content,
					prop.exp.loc,
					prop.exp.loc.start.offset,
					presetInfos.attrReference,
					'(',
					')',
				);
				yield _ts(',\n');
			}
			else if (
				prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
				&& prop.name !== 'name' // slot name
			) {
				yield* generateObjectProperty(
					prop.name,
					prop.loc.start.offset,
					mergeFeatureSettings(
						presetInfos.attr,
						{
							navigation: {
								resolveRenameNewName: camelize,
								resolveRenameEditText: getPropRenameApply(prop.name),
							},
						},
					),
					prop.loc
				);
				yield _ts(': (');
				yield _ts(
					prop.value !== undefined
						? `"${needToUnicode(prop.value.content) ? toUnicode(prop.value.content) : prop.value.content}"`
						: 'true'
				);
				yield _ts('),\n');
			}
		}
		yield _ts('}');
		if (hasScriptSetupSlots) {
			yield _ts(['', 'template', startTagOffset + node.tag.length, presetInfos.diagnosticOnly]);
			yield _ts(`)`);
		}
		yield _ts(`;\n`);

		if (hasScriptSetupSlots) {
			return;
		}

		if (slotNameExpNode) {
			const varSlotExp = `__VLS_${elementIndex++}`;
			yield _ts(`var ${varSlotExp} = `);
			if (typeof slotNameExpNode === 'string') {
				yield _ts(slotNameExpNode);
			}
			else {
				yield* generateInterpolation(
					slotNameExpNode.content,
					slotNameExpNode,
					undefined, undefined,
					'(',
					')',
				);
			}
			yield _ts(` as const;\n`);
			slotExps.set(varSlotExp, {
				varName: varSlot,
			});
		}
		else {
			const slotName = getSlotName();
			slots.set(slotName?.[0] ?? 'default', {
				name: slotName?.[0],
				loc: slotName?.[1],
				tagRange: [startTagOffset, startTagOffset + node.tag.length],
				varName: varSlot,
				nodeLoc: node.loc,
			});
		}

		function getSlotName() {
			for (const prop2 of node.props) {
				if (prop2.name === 'name' && prop2.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop2.value) {
					if (prop2.value.content) {
						return [
							prop2.value.content,
							prop2.loc.start.offset + prop2.loc.source.indexOf(prop2.value.content, prop2.name.length),
						] as const;
					}
				}
			}
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

	function* generateExtraAutoImport(): Generator<CodeAndStack> {

		if (!tempVars.length) {
			return;
		}

		yield _ts('// @ts-ignore\n'); // #2304
		yield _ts('[');
		for (const _vars of tempVars) {
			for (const v of _vars) {
				yield _ts([
					v.text,
					'template',
					v.offset,
					disableAllFeatures({ completion: { isAdditional: true }, }),
				]);
				yield _ts(',');
			}
		}
		yield _ts('];\n');
		tempVars.length = 0;
	}

	function* generateAttrValue(attrNode: CompilerDOM.TextNode, info: VueCodeInformation): Generator<CodeAndStack> {
		const char = attrNode.loc.source.startsWith("'") ? "'" : '"';
		yield _ts(char);
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
		if (needToUnicode(content)) {
			yield _ts(['', 'template', start, info]);
			yield _ts(toUnicode(content));
			yield _ts(['', 'template', end, disableAllFeatures({ __combineLastMapping: true })]);
		}
		else {
			yield _ts([content, 'template', start, info]);
		}
		yield _ts(char);
	}

	function* generateCamelized(code: string, offset: number, info: VueCodeInformation): Generator<CodeAndStack> {
		const parts = code.split('-');
		for (let i = 0; i < parts.length; i++) {
			const part = parts[i];
			if (part !== '') {
				yield _ts([
					i === 0
						? part
						: capitalize(part),
					'template',
					offset,
					i === 0
						? info
						: disableAllFeatures({ __combineLastMapping: true }),
				]);
			}
			offset += part.length + 1;
		}
	}

	function* generateObjectProperty(code: string, offset: number, info: VueCodeInformation, astHolder?: any, shouldCamelize = false): Generator<CodeAndStack> {
		if (code.startsWith('[') && code.endsWith(']') && astHolder) {
			yield* generateInterpolation(code, astHolder, offset, info, '', '');
		}
		else if (shouldCamelize) {
			if (validTsVarReg.test(camelize(code))) {
				yield* generateCamelized(code, offset, info);
			}
			else {
				yield _ts(['', 'template', offset, info]);
				yield _ts('"');
				yield* generateCamelized(code, offset, disableAllFeatures({ __combineLastMapping: true }));
				yield _ts('"');
				yield _ts(['', 'template', offset + code.length, disableAllFeatures({ __combineLastMapping: true })]);
			}
		}
		else {
			if (validTsVarReg.test(code)) {
				yield _ts([code, 'template', offset, info]);
			}
			else {
				yield* generateStringLiteralKey(code, offset, info);
			}
		}
	}

	function* generateInterpolation(
		_code: string,
		astHolder: any,
		start: number | undefined,
		data: VueCodeInformation | (() => VueCodeInformation) | undefined,
		prefix: string,
		suffix: string,
	): Generator<CodeAndStack> {
		const code = prefix + _code + suffix;
		const ast = createTsAst(ts, astHolder, code);
		const vars: {
			text: string,
			isShorthand: boolean,
			offset: number,
		}[] = [];
		for (let [section, offset, onlyError] of eachInterpolationSegment(
			ts,
			code,
			ast,
			localVars,
			accessedGlobalVariables,
			vueCompilerOptions,
			vars,
		)) {
			if (offset === undefined) {
				yield _ts(section);
			}
			else {
				offset -= prefix.length;
				let addSuffix = '';
				const overLength = offset + section.length - _code.length;
				if (overLength > 0) {
					addSuffix = section.substring(section.length - overLength);
					section = section.substring(0, section.length - overLength);
				}
				if (offset < 0) {
					yield _ts(section.substring(0, -offset));
					section = section.substring(-offset);
					offset = 0;
				}
				if (start !== undefined && data !== undefined) {
					yield _ts([
						section,
						'template',
						start + offset,
						onlyError
							? presetInfos.diagnosticOnly
							: typeof data === 'function' ? data() : data,
					]);
				}
				else {
					yield _ts(section);
				}
				yield _ts(addSuffix);
			}
		}
		if (start !== undefined) {
			for (const v of vars) {
				v.offset = start + v.offset - prefix.length;
			}
			if (vars.length) {
				tempVars.push(vars);
			}
		}
	}

	function* generatePropertyAccess(code: string, offset?: number, info?: VueCodeInformation, astHolder?: any): Generator<CodeAndStack> {
		if (!compilerOptions.noPropertyAccessFromIndexSignature && validTsVarReg.test(code)) {
			yield _ts('.');
			yield _ts(offset !== undefined && info
				? [code, 'template', offset, info]
				: code);
		}
		else if (code.startsWith('[') && code.endsWith(']')) {
			yield* generateInterpolation(code, astHolder, offset, info, '', '');
		}
		else {
			yield _ts('[');
			yield* generateStringLiteralKey(code, offset, info);
			yield _ts(']');
		}
	}

	function* generateStringLiteralKey(code: string, offset?: number, info?: VueCodeInformation): Generator<CodeAndStack> {
		if (offset === undefined || !info) {
			yield _ts(`"${code}"`);
		}
		else {
			yield _ts(['', 'template', offset, info]);
			yield _ts('"');
			yield _ts([code, 'template', offset, disableAllFeatures({ __combineLastMapping: true })]);
			yield _ts('"');
			yield _ts(['', 'template', offset + code.length, disableAllFeatures({ __combineLastMapping: true })]);
		}
	}
}

export function createTsAst(ts: typeof import('typescript'), astHolder: any, text: string) {
	if (astHolder.__volar_ast_text !== text) {
		astHolder.__volar_ast_text = text;
		astHolder.__volar_ast = ts.createSourceFile('/a.ts', text, 99 satisfies ts.ScriptTarget.ESNext);
	}
	return astHolder.__volar_ast as ts.SourceFile;
}

export function isCompoundExpression(ts: typeof import('typescript'), ast: ts.SourceFile,) {
	let result = true;
	if (ast.statements.length === 1) {
		ts.forEachChild(ast, child_1 => {
			if (ts.isExpressionStatement(child_1)) {
				ts.forEachChild(child_1, child_2 => {
					if (ts.isArrowFunction(child_2)) {
						result = false;
					}
					else if (ts.isIdentifier(child_2)) {
						result = false;
					}
				});
			}
			else if (ts.isFunctionDeclaration(child_1)) {
				result = false;
			}
		});
	}
	return result;
}

export function parseInterpolationNode(node: CompilerDOM.InterpolationNode, template: string) {
	let content = node.content.loc.source;
	let start = node.content.loc.start.offset;
	let leftCharacter: string;
	let rightCharacter: string;

	// fix https://github.com/vuejs/language-tools/issues/1787
	while ((leftCharacter = template.substring(start - 1, start)).trim() === '' && leftCharacter.length) {
		start--;
		content = leftCharacter + content;
	}
	while ((rightCharacter = template.substring(start + content.length, start + content.length + 1)).trim() === '' && rightCharacter.length) {
		content = content + rightCharacter;
	}

	return [
		content,
		start,
	] as const;
}

export function parseVForNode(node: CompilerDOM.ForNode) {
	const { value, key, index } = node.parseResult;
	const leftExpressionRange = (value || key || index)
		? {
			start: (value ?? key ?? index)!.loc.start.offset,
			end: (index ?? key ?? value)!.loc.end.offset,
		}
		: undefined;
	const leftExpressionText = leftExpressionRange
		? node.loc.source.substring(
			leftExpressionRange.start - node.loc.start.offset,
			leftExpressionRange.end - node.loc.start.offset
		)
		: undefined;
	return {
		leftExpressionRange,
		leftExpressionText,
	};
}

function getCanonicalComponentName(tagText: string) {
	return validTsVarReg.test(tagText)
		? tagText
		: capitalize(camelize(tagText.replace(colonReg, '-')));
}

function getPossibleOriginalComponentNames(tagText: string) {
	return [...new Set([
		// order is important: https://github.com/vuejs/language-tools/issues/2010
		capitalize(camelize(tagText)),
		camelize(tagText),
		tagText,
	])];
}

export function* forEachElementNode(node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode): Generator<CompilerDOM.ElementNode> {
	if (node.type === CompilerDOM.NodeTypes.ROOT) {
		for (const child of node.children) {
			yield* forEachElementNode(child);
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.ELEMENT) {
		const patchForNode = getVForNode(node);
		if (patchForNode) {
			yield* forEachElementNode(patchForNode);
		}
		else {
			yield node;
			for (const child of node.children) {
				yield* forEachElementNode(child);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.IF) {
		// v-if / v-else-if / v-else
		for (let i = 0; i < node.branches.length; i++) {
			const branch = node.branches[i];
			for (const childNode of branch.children) {
				yield* forEachElementNode(childNode);
			}
		}
	}
	else if (node.type === CompilerDOM.NodeTypes.FOR) {
		// v-for
		for (const child of node.children) {
			yield* forEachElementNode(child);
		}
	}
}

function needToUnicode(str: string) {
	return str.indexOf('\\') >= 0 || str.indexOf('\n') >= 0;
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

function getTagRenameApply(oldName: string) {
	return oldName === hyphenateTag(oldName) ? hyphenateTag : undefined;
}

function getPropRenameApply(oldName: string) {
	return oldName === hyphenateAttr(oldName) ? hyphenateAttr : undefined;
}

function getModelValuePropName(node: CompilerDOM.ElementNode, vueVersion: number, vueCompilerOptions: VueCompilerOptions) {

	for (const modelName in vueCompilerOptions.experimentalModelPropName) {
		const tags = vueCompilerOptions.experimentalModelPropName[modelName];
		for (const tag in tags) {
			if (node.tag === tag || node.tag === hyphenateTag(tag)) {
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
			if (node.tag === tag || node.tag === hyphenateTag(tag)) {
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

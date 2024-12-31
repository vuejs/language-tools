import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import type { Code, VueCodeInformation } from '../../types';
import { getSlotsPropertyName, hyphenateTag } from '../../utils/shared';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import { collectVars, createTsAst, endOfLine, newLine, normalizeAttributeValue, variableNameRegex, wrapWith } from '../utils';
import { generateCamelized } from '../utils/camelized';
import type { TemplateCodegenContext } from './context';
import { generateElementChildren } from './elementChildren';
import { generateElementDirectives } from './elementDirectives';
import { generateElementEvents } from './elementEvents';
import { type FailedPropExpression, generateElementProps } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';
import { generatePropertyAccess } from './propertyAccess';
import { collectStyleScopedClassReferences } from './styleScopedClasses';
import { generateTemplateChild } from './templateChild';

const colonReg = /:/g;

export function* generateComponent(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode
): Generator<Code> {
	const tagOffsets = [node.loc.start.offset + options.template.content.slice(node.loc.start.offset).indexOf(node.tag)];
	if (!node.isSelfClosing && options.template.lang === 'html') {
		const endTagOffset = node.loc.start.offset + node.loc.source.lastIndexOf(node.tag);
		if (endTagOffset > tagOffsets[0]) {
			tagOffsets.push(endTagOffset);
		}
	}
	const failedPropExps: FailedPropExpression[] = [];
	const possibleOriginalNames = getPossibleOriginalComponentNames(node.tag, true);
	const matchImportName = possibleOriginalNames.find(name => options.scriptSetupImportComponentNames.has(name));
	const var_originalComponent = matchImportName ?? ctx.getInternalVariable();
	const var_functionalComponent = ctx.getInternalVariable();
	const var_componentInstance = ctx.getInternalVariable();
	const var_componentEmit = ctx.getInternalVariable();
	const var_componentEvents = ctx.getInternalVariable();
	const var_defineComponentCtx = ctx.getInternalVariable();
	const isComponentTag = node.tag.toLowerCase() === 'component';

	ctx.currentComponent = {
		node,
		ctxVar: var_defineComponentCtx,
		used: false
	};

	let props = node.props;
	let dynamicTagInfo: {
		tag: string;
		offsets: number[];
		astHolder: CompilerDOM.SourceLocation;
	} | undefined;

	if (isComponentTag) {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& prop.arg?.loc.source === 'is'
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				if (prop.arg.loc.end.offset === prop.exp.loc.end.offset) {
					ctx.inlayHints.push(createVBindShorthandInlayHintInfo(prop.exp.loc, 'is'));
				}
				dynamicTagInfo = {
					tag: prop.exp.content,
					offsets: [prop.exp.loc.start.offset],
					astHolder: prop.exp.loc,
				};
				props = props.filter(p => p !== prop);
				break;
			}
		}
	}
	else if (node.tag.includes('.')) {
		// namespace tag
		dynamicTagInfo = {
			tag: node.tag,
			offsets: tagOffsets,
			astHolder: node.loc,
		};
	}

	if (matchImportName) {
		// hover, renaming / find references support
		yield `// @ts-ignore${newLine}`; // #2304
		yield `/** @type { [`;
		for (const tagOffset of tagOffsets) {
			yield `typeof `;
			if (var_originalComponent === node.tag) {
				yield [
					var_originalComponent,
					'template',
					tagOffset,
					ctx.codeFeatures.withoutHighlightAndCompletion,
				];
			}
			else {
				const shouldCapitalize = matchImportName[0].toUpperCase() === matchImportName[0];
				yield* generateCamelized(
					shouldCapitalize ? capitalize(node.tag) : node.tag,
					tagOffset,
					{
						...ctx.codeFeatures.withoutHighlightAndCompletion,
						navigation: {
							resolveRenameNewName: camelizeComponentName,
							resolveRenameEditText: getTagRenameApply(node.tag),
						},
					}
				);
			}
			yield `, `;
		}
		yield `] } */${endOfLine}`;
	}
	else if (dynamicTagInfo) {
		yield `const ${var_originalComponent} = (`;
		yield* generateInterpolation(
			options,
			ctx,
			'template',
			ctx.codeFeatures.all,
			dynamicTagInfo.tag,
			dynamicTagInfo.offsets[0],
			dynamicTagInfo.astHolder,
			'(',
			')'
		);
		if (dynamicTagInfo.offsets[1] !== undefined) {
			yield `,`;
			yield* generateInterpolation(
				options,
				ctx,
				'template',
				{
					...ctx.codeFeatures.all,
					completion: false,
				},
				dynamicTagInfo.tag,
				dynamicTagInfo.offsets[1],
				dynamicTagInfo.astHolder,
				'(',
				')'
			);
		}
		yield `)${endOfLine}`;
	}
	else if (!isComponentTag) {
		yield `const ${var_originalComponent} = ({} as __VLS_WithComponent<'${getCanonicalComponentName(node.tag)}', __VLS_LocalComponents, `;
		if (options.selfComponentName && possibleOriginalNames.includes(options.selfComponentName)) {
			yield `typeof __VLS_self & (new () => { `
				+ getSlotsPropertyName(options.vueCompilerOptions.target)
				+ `: typeof ${options.slotsAssignName ?? `__VLS_slots`} }), `;
		}
		else {
			yield `void, `;
		}
		yield getPossibleOriginalComponentNames(node.tag, false)
			.map(name => `'${name}'`)
			.join(`, `);
		yield `>).`;
		yield* generateCanonicalComponentName(
			node.tag,
			tagOffsets[0],
			ctx.codeFeatures.withoutHighlightAndCompletionAndNavigation
		);
		yield `${endOfLine}`;

		const camelizedTag = camelize(node.tag);
		if (variableNameRegex.test(camelizedTag)) {
			// renaming / find references support
			yield `/** @type { [`;
			for (const tagOffset of tagOffsets) {
				for (const shouldCapitalize of (node.tag[0] === node.tag[0].toUpperCase() ? [false] : [true, false])) {
					const expectName = shouldCapitalize ? capitalize(camelizedTag) : camelizedTag;
					yield `typeof __VLS_components.`;
					yield* generateCamelized(
						shouldCapitalize ? capitalize(node.tag) : node.tag,
						tagOffset,
						{
							navigation: {
								resolveRenameNewName: node.tag !== expectName ? camelizeComponentName : undefined,
								resolveRenameEditText: getTagRenameApply(node.tag),
							},
						}
					);
					yield `, `;
				}
			}
			yield `] } */${endOfLine}`;
			// auto import support
			if (options.edited) {
				yield `// @ts-ignore${newLine}`; // #2304
				yield* generateCamelized(
					capitalize(node.tag),
					tagOffsets[0],
					{
						completion: {
							isAdditional: true,
							onlyImport: true,
						},
					}
				);
				yield `${endOfLine}`;
			}
		}
	}
	else {
		yield `const ${var_originalComponent} = {} as any${endOfLine}`;
	}

	yield `// @ts-ignore${newLine}`;
	yield `const ${var_functionalComponent} = __VLS_asFunctionalComponent(${var_originalComponent}, new ${var_originalComponent}({${newLine}`;
	yield* generateElementProps(options, ctx, node, props, options.vueCompilerOptions.strictTemplates, false);
	yield `}))${endOfLine}`;

	yield `const `;
	yield* wrapWith(
		node.loc.start.offset,
		node.loc.end.offset,
		{
			verification: {
				shouldReport(_source, code) {
					return String(code) !== '6133';
				},
			}
		},
		var_componentInstance
	);
	yield ` = ${var_functionalComponent}`;
	yield* generateComponentGeneric(ctx);
	yield `(`;
	yield* wrapWith(
		tagOffsets[0],
		tagOffsets[0] + node.tag.length,
		ctx.codeFeatures.verification,
		`{${newLine}`,
		...generateElementProps(options, ctx, node, props, options.vueCompilerOptions.strictTemplates, true, failedPropExps),
		`}`
	);
	yield `, ...__VLS_functionalComponentArgsRest(${var_functionalComponent}))${endOfLine}`;

	yield* generateFailedPropExps(options, ctx, failedPropExps);

	const [refName, offset] = yield* generateVScope(options, ctx, node, props);
	const isRootNode = node === ctx.singleRootNode;

	if (refName || isRootNode) {
		const varName = ctx.getInternalVariable();
		ctx.currentComponent.used = true;

		yield `var ${varName} = {} as (Parameters<NonNullable<typeof ${var_defineComponentCtx}['expose']>>[0] | null)`;
		if (node.codegenNode?.type === CompilerDOM.NodeTypes.VNODE_CALL
			&& node.codegenNode.props?.type === CompilerDOM.NodeTypes.JS_OBJECT_EXPRESSION
			&& node.codegenNode.props.properties.some(({ key }) => key.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && key.content === 'ref_for')
		) {
			yield `[]`;
		}
		yield `${endOfLine}`;

		if (refName) {
			ctx.templateRefs.set(refName, [varName, offset!]);
		}
		if (isRootNode) {
			ctx.singleRootElType = `NonNullable<typeof ${varName}>['$el']`;
		}
	}

	const usedComponentEventsVar = yield* generateElementEvents(options, ctx, node, var_functionalComponent, var_componentInstance, var_componentEvents);
	if (usedComponentEventsVar) {
		ctx.currentComponent.used = true;
		yield `let ${var_componentEmit}!: typeof ${var_defineComponentCtx}.emit${endOfLine}`;
		yield `let ${var_componentEvents}!: __VLS_NormalizeEmits<typeof ${var_componentEmit}>${endOfLine}`;
	}

	if (
		options.vueCompilerOptions.fallthroughAttributes
		&& (
			node.props.some(prop => prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.exp?.loc.source === '$attrs')
			|| node === ctx.singleRootNode
		)
	) {
		const varAttrs = ctx.getInternalVariable();
		ctx.inheritedAttrVars.add(varAttrs);
		yield `var ${varAttrs}!: Parameters<typeof ${var_functionalComponent}>[0];\n`;
	}

	const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as CompilerDOM.DirectiveNode;
	if (slotDir) {
		yield* generateComponentSlot(options, ctx, node, slotDir);
	}
	else {
		yield* generateElementChildren(options, ctx, node);
	}

	if (ctx.currentComponent.used) {
		yield `var ${var_defineComponentCtx}!: __VLS_PickFunctionalComponentCtx<typeof ${var_originalComponent}, typeof ${var_componentInstance}>${endOfLine}`;
	}
}

export function* generateElement(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	isVForChild: boolean
): Generator<Code> {
	const startTagOffset = node.loc.start.offset + options.template.content.slice(node.loc.start.offset).indexOf(node.tag);
	const endTagOffset = !node.isSelfClosing && options.template.lang === 'html'
		? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag)
		: undefined;
	const failedPropExps: FailedPropExpression[] = [];

	yield `__VLS_elementAsFunction(__VLS_intrinsicElements`;
	yield* generatePropertyAccess(
		options,
		ctx,
		node.tag,
		startTagOffset,
		ctx.codeFeatures.withoutHighlightAndCompletion
	);
	if (endTagOffset !== undefined) {
		yield `, __VLS_intrinsicElements`;
		yield* generatePropertyAccess(
			options,
			ctx,
			node.tag,
			endTagOffset,
			ctx.codeFeatures.withoutHighlightAndCompletion
		);
	}
	yield `)(`;
	yield* wrapWith(
		startTagOffset,
		startTagOffset + node.tag.length,
		ctx.codeFeatures.verification,
		`{${newLine}`,
		...generateElementProps(options, ctx, node, node.props, options.vueCompilerOptions.strictTemplates, true, failedPropExps),
		`}`
	);
	yield `)${endOfLine}`;

	yield* generateFailedPropExps(options, ctx, failedPropExps);

	const [refName, offset] = yield* generateVScope(options, ctx, node, node.props);
	if (refName) {
		let refValue = `__VLS_nativeElements['${node.tag}']`;
		if (isVForChild) {
			refValue = `[${refValue}]`;
		}
		ctx.templateRefs.set(refName, [refValue, offset!]);
	}
	if (ctx.singleRootNode === node) {
		ctx.singleRootElType = `typeof __VLS_nativeElements['${node.tag}']`;
	}

	const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as CompilerDOM.DirectiveNode;
	if (slotDir && ctx.currentComponent) {
		yield* generateComponentSlot(options, ctx, node, slotDir);
	}
	else {
		yield* generateElementChildren(options, ctx, node);
	}

	if (
		options.vueCompilerOptions.fallthroughAttributes
		&& (
			node.props.some(prop => prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.exp?.loc.source === '$attrs')
			|| node === ctx.singleRootNode
		)
	) {
		ctx.inheritedAttrVars.add(`__VLS_intrinsicElements.${node.tag}`);
	}
}

function* generateFailedPropExps(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	failedPropExps: FailedPropExpression[]
): Generator<Code> {
	for (const failedExp of failedPropExps) {
		yield* generateInterpolation(
			options,
			ctx,
			'template',
			ctx.codeFeatures.all,
			failedExp.node.loc.source,
			failedExp.node.loc.start.offset,
			failedExp.node.loc,
			failedExp.prefix,
			failedExp.suffix
		);
		yield endOfLine;
	}
}

function* generateVScope(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	props: (CompilerDOM.AttributeNode | CompilerDOM.DirectiveNode)[]
): Generator<Code, [refName?: string, offset?: number]> {
	const vScope = props.find(prop => prop.type === CompilerDOM.NodeTypes.DIRECTIVE && (prop.name === 'scope' || prop.name === 'data'));
	let inScope = false;
	let originalConditionsNum = ctx.blockConditions.length;

	if (vScope?.type === CompilerDOM.NodeTypes.DIRECTIVE && vScope.exp) {

		const scopeVar = ctx.getInternalVariable();
		const condition = `__VLS_withScope(__VLS_ctx, ${scopeVar})`;

		yield `const ${scopeVar} = `;
		yield [
			vScope.exp.loc.source,
			'template',
			vScope.exp.loc.start.offset,
			ctx.codeFeatures.all,
		];
		yield endOfLine;
		yield `if (${condition}) {${newLine}`;
		ctx.blockConditions.push(condition);
		inScope = true;
	}

	yield* generateElementDirectives(options, ctx, node);
	const [refName, offset] = yield* generateReferencesForElements(options, ctx, node); // <el ref="foo" />
	collectStyleScopedClassReferences(options, ctx, node);

	if (inScope) {
		yield `}${newLine}`;
		ctx.blockConditions.length = originalConditionsNum;
	}
	return [refName, offset];
}

function getCanonicalComponentName(tagText: string) {
	return variableNameRegex.test(tagText)
		? tagText
		: capitalize(camelize(tagText.replace(colonReg, '-')));
}

function getPossibleOriginalComponentNames(tagText: string, deduplicate: boolean) {
	const name1 = capitalize(camelize(tagText));
	const name2 = camelize(tagText);
	const name3 = tagText;
	const names: string[] = [name1];
	if (!deduplicate || name2 !== name1) {
		names.push(name2);
	}
	if (!deduplicate || name3 !== name2) {
		names.push(name3);
	}
	return names;
}

function* generateCanonicalComponentName(tagText: string, offset: number, features: VueCodeInformation): Generator<Code> {
	if (variableNameRegex.test(tagText)) {
		yield [tagText, 'template', offset, features];
	}
	else {
		yield* generateCamelized(
			capitalize(tagText.replace(colonReg, '-')),
			offset,
			features
		);
	}
}

function* generateComponentGeneric(
	ctx: TemplateCodegenContext
): Generator<Code> {
	if (ctx.lastGenericComment) {
		const { content, offset } = ctx.lastGenericComment;
		yield* wrapWith(
			offset,
			offset + content.length,
			ctx.codeFeatures.verification,
			`<`,
			[
				content,
				'template',
				offset,
				ctx.codeFeatures.all
			],
			`>`
		);
	}
	ctx.lastGenericComment = undefined;
}

function* generateComponentSlot(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	slotDir: CompilerDOM.DirectiveNode
): Generator<Code> {
	yield `{${newLine}`;
	if (ctx.currentComponent) {
		ctx.currentComponent.used = true;
		ctx.hasSlotElements.add(ctx.currentComponent.node);
	}
	const slotBlockVars: string[] = [];
	yield `const {`;
	if (slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && slotDir.arg.content) {
		yield* generateObjectProperty(
			options,
			ctx,
			slotDir.arg.loc.source,
			slotDir.arg.loc.start.offset,
			slotDir.arg.isStatic ? ctx.codeFeatures.withoutHighlight : ctx.codeFeatures.all,
			slotDir.arg.loc,
			false,
			true
		);
	}
	else {
		yield* wrapWith(
			slotDir.loc.start.offset,
			slotDir.loc.start.offset + (slotDir.rawName?.length ?? 0),
			ctx.codeFeatures.withoutHighlightAndCompletion,
			`default`
		);
	}
	yield `: __VLS_thisSlot } = ${ctx.currentComponent!.ctxVar}.slots!${endOfLine}`;

	if (slotDir?.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const slotAst = createTsAst(options.ts, slotDir, `(${slotDir.exp.content}) => {}`);
		collectVars(options.ts, slotAst, slotAst, slotBlockVars);
		if (!slotDir.exp.content.includes(':')) {
			yield `const [`;
			yield [
				slotDir.exp.content,
				'template',
				slotDir.exp.loc.start.offset,
				ctx.codeFeatures.all,
			];
			yield `] = __VLS_getSlotParams(__VLS_thisSlot)${endOfLine}`;
		}
		else {
			yield `const `;
			yield [
				slotDir.exp.content,
				'template',
				slotDir.exp.loc.start.offset,
				ctx.codeFeatures.all,
			];
			yield ` = __VLS_getSlotParam(__VLS_thisSlot)${endOfLine}`;
		}
	}

	for (const varName of slotBlockVars) {
		ctx.addLocalVariable(varName);
	}

	yield* ctx.resetDirectiveComments('end of slot children start');

	let prev: CompilerDOM.TemplateChildNode | undefined;
	for (const childNode of node.children) {
		yield* generateTemplateChild(options, ctx, childNode, prev);
		prev = childNode;
	}

	for (const varName of slotBlockVars) {
		ctx.removeLocalVariable(varName);
	}
	let isStatic = true;
	if (slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		isStatic = slotDir.arg.isStatic;
	}
	if (isStatic && slotDir && !slotDir.arg) {
		yield `${ctx.currentComponent!.ctxVar}.slots!['`;
		yield [
			'',
			'template',
			slotDir.loc.start.offset + (
				slotDir.loc.source.startsWith('#')
					? '#'.length : slotDir.loc.source.startsWith('v-slot:')
						? 'v-slot:'.length
						: 0
			),
			ctx.codeFeatures.completion,
		];
		yield `'/* empty slot name completion */]${newLine}`;
	}

	yield* ctx.generateAutoImportCompletion();
	yield `}${newLine}`;
}

function* generateReferencesForElements(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode
): Generator<Code, [refName: string, offset: number] | []> {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& prop.name === 'ref'
			&& prop.value
		) {
			const [content, startOffset] = normalizeAttributeValue(prop.value);

			yield `// @ts-ignore navigation for \`const ${content} = ref()\`${newLine}`;
			yield `/** @type { typeof __VLS_ctx`;
			yield* generatePropertyAccess(
				options,
				ctx,
				content,
				startOffset,
				ctx.codeFeatures.navigation,
				prop.value.loc
			);
			yield ` } */${endOfLine}`;

			if (variableNameRegex.test(content) && !options.templateRefNames.has(content)) {
				ctx.accessExternalVariable(content, startOffset);
			}

			return [content, startOffset];
		}
	}
	return [];
}

function camelizeComponentName(newName: string) {
	return camelize('-' + newName);
}

function getTagRenameApply(oldName: string) {
	return oldName === hyphenateTag(oldName) ? hyphenateTag : undefined;
}

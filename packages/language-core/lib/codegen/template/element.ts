import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import type { Code, VueCodeInformation } from '../../types';
import { hyphenateTag } from '../../utils/shared';
import { collectVars, createTsAst, endOfLine, newLine, variableNameRegex, wrapWith } from '../common';
import { generateCamelized } from './camelized';
import type { TemplateCodegenContext } from './context';
import { generateElementChildren } from './elementChildren';
import { generateElementDirectives } from './elementDirectives';
import { generateElementEvents } from './elementEvents';
import { generateElementProps } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generatePropertyAccess } from './propertyAccess';
import { generateTemplateChild } from './templateChild';

const colonReg = /:/g;

export function* generateComponent(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	currentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string | undefined,
): Generator<Code> {
	const startTagOffset = node.loc.start.offset + options.template.content.substring(node.loc.start.offset).indexOf(node.tag);
	const propsFailedExps: CompilerDOM.SimpleExpressionNode[] = [];
	const var_originalComponent = ctx.getInternalVariable();
	const var_functionalComponent = ctx.getInternalVariable();
	const var_componentInstance = ctx.getInternalVariable();
	const var_componentEvents = ctx.getInternalVariable();
	const isComponentTag = node.tag.toLowerCase() === 'component';

	let endTagOffset = !node.isSelfClosing && options.template.lang === 'html' ? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) : undefined;
	let tag = node.tag;
	let tagOffsets = endTagOffset !== undefined
		? [startTagOffset, endTagOffset]
		: [startTagOffset];
	let props = node.props;
	let dynamicTagInfo: {
		exp: string;
		offset: number;
		astHolder: any;
	} | undefined;
	let defineComponentCtxVar: string | undefined;
	let usedComponentEventsVar = false;

	if (isComponentTag) {
		for (const prop of node.props) {
			if (prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.arg?.loc.source === 'is' && prop.exp) {
				dynamicTagInfo = {
					exp: prop.exp.loc.source,
					offset: prop.exp.loc.start.offset,
					astHolder: prop.exp.loc,
				};
				props = props.filter(p => p !== prop);
				break;
			}
		}
	}
	else if (tag.includes('.')) {
		// namespace tag
		dynamicTagInfo = {
			exp: tag,
			astHolder: node.loc,
			offset: startTagOffset,
		};
	}

	if (dynamicTagInfo) {
		yield `const ${var_originalComponent} = `;
		yield* generateInterpolation(
			options,
			ctx,
			dynamicTagInfo.exp,
			dynamicTagInfo.astHolder,
			dynamicTagInfo.offset,
			ctx.codeFeatures.all,
			'(',
			')',
		);
		yield endOfLine;
	}
	else if (!isComponentTag) {
		yield `const ${var_originalComponent} = ({} as `;
		for (const componentName of getPossibleOriginalComponentNames(tag, true)) {
			yield `'${componentName}' extends keyof typeof __VLS_ctx ? { '${getCanonicalComponentName(tag)}': typeof __VLS_ctx`;
			yield* generatePropertyAccess(options, ctx, componentName);
			yield ` }: `;
		}
		yield `typeof __VLS_resolvedLocalAndGlobalComponents)`;
		yield* generatePropertyAccess(
			options,
			ctx,
			getCanonicalComponentName(tag),
			startTagOffset,
			ctx.codeFeatures.verification,
		);
		yield endOfLine;
	}
	else {
		yield `const ${var_originalComponent} = {} as any${endOfLine}`;
	}

	yield `const ${var_functionalComponent} = __VLS_asFunctionalComponent(${var_originalComponent}, new ${var_originalComponent}({`;
	yield* generateElementProps(options, ctx, node, props, false);
	yield `}))${endOfLine}`;

	if (
		!dynamicTagInfo
		&& !isComponentTag
	) {
		// hover support
		for (const offset of tagOffsets) {
			yield `({} as { ${getCanonicalComponentName(tag)}: typeof ${var_originalComponent} }).`;
			yield* generateCanonicalComponentName(
				tag,
				offset,
				ctx.codeFeatures.withoutHighlightAndCompletionAndNavigation,
			);
			yield endOfLine;
		}
		const camelizedTag = camelize(node.tag);
		if (variableNameRegex.test(camelizedTag)) {
			// renaming / find references support
			for (const tagOffset of tagOffsets) {
				for (const shouldCapitalize of (node.tag[0] === node.tag[0].toUpperCase() ? [false] : [true, false])) {
					const expectName = shouldCapitalize ? capitalize(camelizedTag) : camelizedTag;
					yield `__VLS_components.`;
					yield* generateCamelized(
						shouldCapitalize ? capitalize(node.tag) : node.tag,
						tagOffset,
						{
							navigation: {
								resolveRenameNewName: node.tag !== expectName ? camelizeComponentName : undefined,
								resolveRenameEditText: getTagRenameApply(node.tag),
							},
						} as VueCodeInformation,
					);
					yield `;`;
				}
			}
			yield `${newLine}`;
			// auto import support
			yield `// @ts-ignore${newLine}`; // #2304
			yield `[`;
			for (const tagOffset of tagOffsets) {
				yield* generateCamelized(
					capitalize(node.tag),
					tagOffset,
					{
						completion: {
							isAdditional: true,
							onlyImport: true,
						},
					} as VueCodeInformation,
				);
				yield `,`;
			}
			yield `]${endOfLine}`;
		}
	}

	if (options.vueCompilerOptions.strictTemplates) {
		// with strictTemplates, generate once for props type-checking + instance type
		yield `const ${var_componentInstance} = ${var_functionalComponent}(`;
		yield* wrapWith(
			startTagOffset,
			startTagOffset + tag.length,
			ctx.codeFeatures.verification,
			`{`,
			...generateElementProps(options, ctx, node, props, true, propsFailedExps),
			`}`,
		);
		yield `, ...__VLS_functionalComponentArgsRest(${var_functionalComponent}))${endOfLine}`;
	}
	else {
		// without strictTemplates, this only for instacne type
		yield `const ${var_componentInstance} = ${var_functionalComponent}({`;
		yield* generateElementProps(options, ctx, node, props, false);
		yield `}, ...__VLS_functionalComponentArgsRest(${var_functionalComponent}))${endOfLine}`;
		// and this for props type-checking
		yield `({} as (props: __VLS_FunctionalComponentProps<typeof ${var_originalComponent}, typeof ${var_componentInstance}> & Record<string, unknown>) => void)(`;
		yield* wrapWith(
			startTagOffset,
			startTagOffset + tag.length,
			ctx.codeFeatures.verification,
			`{`,
			...generateElementProps(options, ctx, node, props, true, propsFailedExps),
			`}`,
		);
		yield `)${endOfLine}`;
	}

	defineComponentCtxVar = ctx.getInternalVariable();
	componentCtxVar = defineComponentCtxVar;
	currentComponent = node;

	for (const failedExp of propsFailedExps) {
		yield* generateInterpolation(
			options,
			ctx,
			failedExp.loc.source,
			failedExp.loc,
			failedExp.loc.start.offset,
			ctx.codeFeatures.all,
			'(',
			')',
		);
		yield endOfLine;
	}

	yield* generateVScope(options, ctx, node, props);

	if (componentCtxVar) {
		ctx.usedComponentCtxVars.add(componentCtxVar);
		yield* generateElementEvents(options, ctx, node, var_functionalComponent, var_componentInstance, var_componentEvents, () => usedComponentEventsVar = true);
	}

	const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as CompilerDOM.DirectiveNode;
	if (slotDir && componentCtxVar) {
		yield* generateComponentSlot(options, ctx, node, slotDir, currentComponent, componentCtxVar);
	}
	else {
		yield* generateElementChildren(options, ctx, node, currentComponent, componentCtxVar);
	}

	if (defineComponentCtxVar && ctx.usedComponentCtxVars.has(defineComponentCtxVar)) {
		yield `const ${componentCtxVar} = __VLS_pickFunctionalComponentCtx(${var_originalComponent}, ${var_componentInstance})!${endOfLine}`;
	}
	if (usedComponentEventsVar) {
		yield `let ${var_componentEvents}!: __VLS_NormalizeEmits<typeof ${componentCtxVar}.emit>${endOfLine}`;
	}
}

export function* generateElement(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	currentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string | undefined,
): Generator<Code> {
	const startTagOffset = node.loc.start.offset + options.template.content.substring(node.loc.start.offset).indexOf(node.tag);
	const endTagOffset = !node.isSelfClosing && options.template.lang === 'html'
		? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag)
		: undefined;
	const propsFailedExps: CompilerDOM.SimpleExpressionNode[] = [];

	yield `__VLS_elementAsFunction(__VLS_intrinsicElements`;
	yield* generatePropertyAccess(
		options,
		ctx,
		node.tag,
		startTagOffset,
		ctx.codeFeatures.withoutHighlightAndCompletion,
	);
	if (endTagOffset !== undefined) {
		yield `, __VLS_intrinsicElements`;
		yield* generatePropertyAccess(
			options,
			ctx,
			node.tag,
			endTagOffset,
			ctx.codeFeatures.withoutHighlightAndCompletion,
		);
	}
	yield `)(`;
	yield* wrapWith(
		startTagOffset,
		startTagOffset + node.tag.length,
		ctx.codeFeatures.verification,
		`{`,
		...generateElementProps(options, ctx, node, node.props, true, propsFailedExps),
		`}`,
	);
	yield `)${endOfLine}`;

	for (const failedExp of propsFailedExps) {
		yield* generateInterpolation(
			options,
			ctx,
			failedExp.loc.source,
			failedExp.loc,
			failedExp.loc.start.offset,
			ctx.codeFeatures.all,
			'(',
			')',
		);
		yield endOfLine;
	}

	yield* generateVScope(options, ctx, node, node.props);

	const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as CompilerDOM.DirectiveNode;
	if (slotDir && componentCtxVar) {
		yield* generateComponentSlot(options, ctx, node, slotDir, currentComponent, componentCtxVar);
	}
	else {
		yield* generateElementChildren(options, ctx, node, currentComponent, componentCtxVar);
	}
}

function* generateVScope(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	props: (CompilerDOM.AttributeNode | CompilerDOM.DirectiveNode)[],
): Generator<Code> {
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
	yield* generateReferencesForElements(options, ctx, node); // <el ref="foo" />
	if (options.shouldGenerateScopedClasses) {
		yield* generateReferencesForScopedCssClasses(ctx, node);
	}

	if (inScope) {
		yield `}${newLine}`;
		ctx.blockConditions.length = originalConditionsNum;
	}
}

export function getCanonicalComponentName(tagText: string) {
	return variableNameRegex.test(tagText)
		? tagText
		: capitalize(camelize(tagText.replace(colonReg, '-')));
}

export function getPossibleOriginalComponentNames(tagText: string, deduplicate: boolean) {
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

function* generateComponentSlot(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	slotDir: CompilerDOM.DirectiveNode,
	currentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string,
): Generator<Code> {
	yield `{${newLine}`;
	ctx.usedComponentCtxVars.add(componentCtxVar);
	if (currentComponent) {
		ctx.hasSlotElements.add(currentComponent);
	}
	const slotBlockVars: string[] = [];
	let hasProps = false;
	if (slotDir?.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {

		const slotAst = createTsAst(options.ts, slotDir, `(${slotDir.exp.content}) => {}`);
		collectVars(options.ts, slotAst, slotAst, slotBlockVars);
		hasProps = true;
		if (!slotDir.exp.content.includes(':')) {
			yield `const [`;
			yield [
				slotDir.exp.content,
				'template',
				slotDir.exp.loc.start.offset,
				ctx.codeFeatures.all,
			];
			yield `] = __VLS_getSlotParams(`;
		}
		else {
			yield `const `;
			yield [
				slotDir.exp.content,
				'template',
				slotDir.exp.loc.start.offset,
				ctx.codeFeatures.all,
			];
			yield ` = __VLS_getSlotParam(`;
		}
	}
	yield* wrapWith(
		(slotDir.arg ?? slotDir).loc.start.offset,
		(slotDir.arg ?? slotDir).loc.end.offset,
		ctx.codeFeatures.verification,
		`(${componentCtxVar}.slots!)`,
		...(
			slotDir?.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && slotDir.arg.content
				? generatePropertyAccess(
					options,
					ctx,
					slotDir.arg.loc.source,
					slotDir.arg.loc.start.offset,
					slotDir.arg.isStatic ? ctx.codeFeatures.withoutHighlight : ctx.codeFeatures.all,
					slotDir.arg.loc
				)
				: [
					`.`,
					...wrapWith(
						slotDir.loc.start.offset,
						slotDir.loc.start.offset + (
							slotDir.loc.source.startsWith('#')
								? '#'.length
								: slotDir.loc.source.startsWith('v-slot:')
									? 'v-slot:'.length
									: 0
						),
						ctx.codeFeatures.withoutHighlightAndCompletion,
						`default`,
					)
				]
		)
	);
	if (hasProps) {
		yield `)`;
	}
	yield endOfLine;

	for (const varName of slotBlockVars) {
		ctx.addLocalVariable(varName);
	}

	yield* ctx.resetDirectiveComments('end of slot children start');

	let prev: CompilerDOM.TemplateChildNode | undefined;
	for (const childNode of node.children) {
		yield* generateTemplateChild(options, ctx, childNode, currentComponent, prev, componentCtxVar);
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
		yield `${componentCtxVar}.slots!['`;
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
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& prop.name === 'ref'
			&& prop.value
		) {
			yield `// @ts-ignore${newLine}`;
			yield* generateInterpolation(
				options,
				ctx,
				prop.value.content,
				prop.value.loc,
				prop.value.loc.start.offset + 1,
				ctx.codeFeatures.navigation,
				'(',
				')',
			);
			yield endOfLine;
		}
	}
}

function* generateReferencesForScopedCssClasses(
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
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
						ctx.scopedClasses.push({ className: tempClassName, offset: startOffset });
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
			yield `__VLS_styleScopedClasses = (`;
			yield [
				prop.exp.content,
				'template',
				prop.exp.loc.start.offset,
				ctx.codeFeatures.navigationAndCompletion,
			];
			yield `)${endOfLine}`;
		}
	}
}

function camelizeComponentName(newName: string) {
	return camelize('-' + newName);
}

function getTagRenameApply(oldName: string) {
	return oldName === hyphenateTag(oldName) ? hyphenateTag : undefined;
}

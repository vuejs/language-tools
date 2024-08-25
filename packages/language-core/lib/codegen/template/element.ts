import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
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
import { generateObjectProperty } from './objectProperty';

const colonReg = /:/g;

export function* generateComponent(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	currentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string | undefined
): Generator<Code> {
	const startTagOffset = node.loc.start.offset + options.template.content.substring(node.loc.start.offset).indexOf(node.tag);
	const endTagOffset = !node.isSelfClosing && options.template.lang === 'html' ? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) : undefined;
	const tagOffsets = endTagOffset !== undefined
		? [startTagOffset, endTagOffset]
		: [startTagOffset];
	const propsFailedExps: {
		node: CompilerDOM.SimpleExpressionNode;
		prefix: string;
		suffix: string;
	}[] = [];
	const possibleOriginalNames = getPossibleOriginalComponentNames(node.tag, true);
	const matchImportName = possibleOriginalNames.find(name => options.scriptSetupImportComponentNames.has(name));
	const var_originalComponent = matchImportName ?? ctx.getInternalVariable();
	const var_functionalComponent = ctx.getInternalVariable();
	const var_componentInstance = ctx.getInternalVariable();
	const var_componentEmit = ctx.getInternalVariable();
	const var_componentEvents = ctx.getInternalVariable();
	const var_defineComponentCtx = ctx.getInternalVariable();
	const isComponentTag = node.tag.toLowerCase() === 'component';

	let props = node.props;
	let dynamicTagInfo: {
		exp: string;
		offsets: [number, number | undefined];
		astHolder: any;
	} | undefined;

	if (isComponentTag) {
		for (const prop of node.props) {
			if (prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.arg?.loc.source === 'is' && prop.exp) {
				dynamicTagInfo = {
					exp: prop.exp.loc.source,
					offsets: [prop.exp.loc.start.offset, undefined],
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
			exp: node.tag,
			astHolder: node.loc,
			offsets: [startTagOffset, endTagOffset],
		};
	}

	if (matchImportName) {
		// hover, renaming / find references support
		yield `// @ts-ignore${newLine}`; // #2304
		yield `[`;
		for (const tagOffset of tagOffsets) {
			if (var_originalComponent === node.tag) {
				yield [
					var_originalComponent,
					'template',
					tagOffset,
					ctx.codeFeatures.withoutHighlightAndCompletion,
				];
			}
			else {
				yield* generateCamelized(
					capitalize(node.tag),
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
			yield `,`;
		}
		yield `]${endOfLine}`;
	}
	else if (dynamicTagInfo) {
		yield `const ${var_originalComponent} = (`;
		yield* generateInterpolation(
			options,
			ctx,
			dynamicTagInfo.exp,
			dynamicTagInfo.astHolder,
			dynamicTagInfo.offsets[0],
			ctx.codeFeatures.all,
			'(',
			')'
		);
		if (dynamicTagInfo.offsets[1] !== undefined) {
			yield `,`;
			yield* generateInterpolation(
				options,
				ctx,
				dynamicTagInfo.exp,
				dynamicTagInfo.astHolder,
				dynamicTagInfo.offsets[1],
				{
					...ctx.codeFeatures.all,
					completion: false,
				},
				'(',
				')'
			);
		}
		yield `)${endOfLine}`;
	}
	else if (!isComponentTag) {
		yield `// @ts-ignore${newLine}`;
		yield `const ${var_originalComponent} = ({} as `;
		for (const componentName of possibleOriginalNames) {
			yield `'${componentName}' extends keyof typeof __VLS_ctx ? { '${getCanonicalComponentName(node.tag)}': typeof __VLS_ctx`;
			yield* generatePropertyAccess(options, ctx, componentName);
			yield ` }: `;
		}
		yield `typeof __VLS_resolvedLocalAndGlobalComponents)${newLine}`;
		yield* generatePropertyAccess(
			options,
			ctx,
			getCanonicalComponentName(node.tag),
			startTagOffset,
			ctx.codeFeatures.verification
		);
		yield endOfLine;

		// hover support
		for (const offset of tagOffsets) {
			yield `({} as { ${getCanonicalComponentName(node.tag)}: typeof ${var_originalComponent} }).`;
			yield* generateCanonicalComponentName(
				node.tag,
				offset,
				ctx.codeFeatures.withoutHighlightAndCompletionAndNavigation
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
						}
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
					}
				);
				yield `,`;
			}
			yield `]${endOfLine}`;
		}
	}
	else {
		yield `const ${var_originalComponent} = {} as any${endOfLine}`;
	}

	yield `// @ts-ignore${newLine}`;
	yield `const ${var_functionalComponent} = __VLS_asFunctionalComponent(${var_originalComponent}, new ${var_originalComponent}({`;
	yield* generateElementProps(options, ctx, node, props, false);
	yield `}))${endOfLine}`;

	if (options.vueCompilerOptions.strictTemplates) {
		// with strictTemplates, generate once for props type-checking + instance type
		yield `const ${var_componentInstance} = ${var_functionalComponent}(`;
		yield* wrapWith(
			startTagOffset,
			startTagOffset + node.tag.length,
			ctx.codeFeatures.verification,
			`{`,
			...generateElementProps(options, ctx, node, props, true, propsFailedExps),
			`}`
		);
		yield `, ...__VLS_functionalComponentArgsRest(${var_functionalComponent}))${endOfLine}`;
	}
	else {
		// without strictTemplates, this only for instance type
		yield `const ${var_componentInstance} = ${var_functionalComponent}({`;
		yield* generateElementProps(options, ctx, node, props, false);
		yield `}, ...__VLS_functionalComponentArgsRest(${var_functionalComponent}))${endOfLine}`;
		// and this for props type-checking
		yield `({} as (props: __VLS_FunctionalComponentProps<typeof ${var_originalComponent}, typeof ${var_componentInstance}> & Record<string, unknown>) => void)(`;
		yield* wrapWith(
			startTagOffset,
			startTagOffset + node.tag.length,
			ctx.codeFeatures.verification,
			`{`,
			...generateElementProps(options, ctx, node, props, true, propsFailedExps),
			`}`
		);
		yield `)${endOfLine}`;
	}

	componentCtxVar = var_defineComponentCtx;
	currentComponent = node;

	for (const failedExp of propsFailedExps) {
		yield* generateInterpolation(
			options,
			ctx,
			failedExp.node.loc.source,
			failedExp.node.loc,
			failedExp.node.loc.start.offset,
			ctx.codeFeatures.all,
			failedExp.prefix,
			failedExp.suffix
		);
		yield endOfLine;
	}

	const refName = yield* generateVScope(options, ctx, node, props);

	ctx.usedComponentCtxVars.add(componentCtxVar);
	const usedComponentEventsVar = yield* generateElementEvents(options, ctx, node, var_functionalComponent, var_componentInstance, var_componentEmit, var_componentEvents);

	if (var_defineComponentCtx && ctx.usedComponentCtxVars.has(var_defineComponentCtx)) {
		yield `const ${componentCtxVar} = __VLS_nonNullable(__VLS_pickFunctionalComponentCtx(${var_originalComponent}, ${var_componentInstance}))${endOfLine}`;
		if (refName) {
			yield `// @ts-ignore${newLine}`;
			if (node.codegenNode?.type === CompilerDOM.NodeTypes.VNODE_CALL
				&& node.codegenNode.props?.type === CompilerDOM.NodeTypes.JS_OBJECT_EXPRESSION
				&& node.codegenNode.props.properties.find(({ key }) => key.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && key.content === 'ref_for')
			) {
				yield `(${refName} ??= []).push(${var_defineComponentCtx})`;
			} else {
				yield `${refName} = ${var_defineComponentCtx}`;
			}

			yield endOfLine;
		}
	}
	if (usedComponentEventsVar) {
		yield `let ${var_componentEmit}!: typeof ${componentCtxVar}.emit${endOfLine}`;
		yield `let ${var_componentEvents}!: __VLS_NormalizeEmits<typeof ${var_componentEmit}>${endOfLine}`;
	}

	if (
		node.props.some(prop => prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.exp?.loc.source === '$attrs')
		|| node === ctx.singleRootNode
	) {
		const varAttrs = ctx.getInternalVariable();
		ctx.inheritedAttrVars.add(varAttrs);
		yield `var ${varAttrs}!: Parameters<typeof ${var_functionalComponent}>[0];\n`;
	}

	const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as CompilerDOM.DirectiveNode;
	if (slotDir) {
		yield* generateComponentSlot(options, ctx, node, slotDir, currentComponent, componentCtxVar);
	}
	else {
		yield* generateElementChildren(options, ctx, node, currentComponent, componentCtxVar);
	}
}

export function* generateElement(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	currentComponent: CompilerDOM.ElementNode | undefined,
	componentCtxVar: string | undefined
): Generator<Code> {
	const startTagOffset = node.loc.start.offset + options.template.content.substring(node.loc.start.offset).indexOf(node.tag);
	const endTagOffset = !node.isSelfClosing && options.template.lang === 'html'
		? node.loc.start.offset + node.loc.source.lastIndexOf(node.tag)
		: undefined;
	const propsFailedExps: {
		node: CompilerDOM.SimpleExpressionNode;
		prefix: string;
		suffix: string;
	}[] = [];

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
		`{`,
		...generateElementProps(options, ctx, node, node.props, true, propsFailedExps),
		`}`
	);
	yield `)${endOfLine}`;

	for (const failedExp of propsFailedExps) {
		yield* generateInterpolation(
			options,
			ctx,
			failedExp.node.loc.source,
			failedExp.node.loc,
			failedExp.node.loc.start.offset,
			ctx.codeFeatures.all,
			failedExp.prefix,
			failedExp.suffix
		);
		yield endOfLine;
	}

	const refName = yield* generateVScope(options, ctx, node, node.props);
	if (refName) {
		yield `// @ts-ignore${newLine}`;
		yield `${refName} = __VLS_intrinsicElements`;
		yield* generatePropertyAccess(
			options,
			ctx,
			node.tag
		);
		yield endOfLine;
	}

	const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as CompilerDOM.DirectiveNode;
	if (slotDir && componentCtxVar) {
		yield* generateComponentSlot(options, ctx, node, slotDir, currentComponent, componentCtxVar);
	}
	else {
		yield* generateElementChildren(options, ctx, node, currentComponent, componentCtxVar);
	}

	if (
		node.props.some(prop => prop.type === CompilerDOM.NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.exp?.loc.source === '$attrs')
		|| node === ctx.singleRootNode
	) {
		ctx.inheritedAttrVars.add(`__VLS_intrinsicElements.${node.tag}`);
	}
}

function* generateVScope(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	props: (CompilerDOM.AttributeNode | CompilerDOM.DirectiveNode)[]
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
	const refName = yield* generateReferencesForElements(options, ctx, node); // <el ref="foo" />
	yield* generateReferencesForScopedCssClasses(options, ctx, node);

	if (inScope) {
		yield `}${newLine}`;
		ctx.blockConditions.length = originalConditionsNum;
	}
	return refName;
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
	componentCtxVar: string
): Generator<Code> {
	yield `{${newLine}`;
	ctx.usedComponentCtxVars.add(componentCtxVar);
	if (currentComponent) {
		ctx.hasSlotElements.add(currentComponent);
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
		yield ': __VLS_thisSlot';
	}
	else {
		yield `default: `;
		yield* wrapWith(
			slotDir.loc.start.offset,
			slotDir.loc.start.offset + (
				slotDir.loc.source.startsWith('#')
					? '#'.length
					: slotDir.loc.source.startsWith('v-slot:')
						? 'v-slot:'.length
						: 0
			),
			ctx.codeFeatures.withoutHighlightAndCompletion,
			`__VLS_thisSlot`
		);
	}
	yield `} = __VLS_nonNullable(${componentCtxVar}.slots)${endOfLine}`;

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
		yield `__VLS_nonNullable(${componentCtxVar}.slots)['`;
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
				')'
			);
			yield endOfLine;

			const refName = CompilerDOM.toValidAssetId(prop.value.content, '_VLS_refs' as any);
			options.templateRefNames.set(prop.value.content, refName);
			return refName;
		}
	}
}

function* generateReferencesForScopedCssClasses(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode
): Generator<Code> {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& prop.name === 'class'
			&& prop.value
		) {
			if (options.template.lang === 'pug') {
				const getClassOffset = Reflect.get(prop.value.loc.start, 'getClassOffset') as (offset: number) => number;
				const content = prop.value.loc.source.slice(1, -1);

				let startOffset = 1;
				for (const className of content.split(' ')) {
					if (className) {
						ctx.scopedClasses.push({
							source: 'template',
							className,
							offset: getClassOffset(startOffset),
						});
					}
					startOffset += className.length + 1;
				}
			}
			else {
				let startOffset = prop.value.loc.start.offset;
				let content = prop.value.loc.source;
				let isWrapped = false;
				if (
					(content.startsWith(`'`) && content.endsWith(`'`))
					|| (content.startsWith(`"`) && content.endsWith(`"`))
				) {
					content = content.slice(1, -1);
					isWrapped = true;
				}
				if (content) {
					const classes = collectClasses(content, startOffset + (isWrapped ? 1 : 0));
					ctx.scopedClasses.push(...classes);
				}
				else {
					ctx.emptyClassOffsets.push(startOffset);
				}
			}
		}
		else if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			&& prop.arg.content === 'class'
		) {
			const content = '`${' + prop.exp.content + '}`';
			const startOffset = prop.exp.loc.start.offset - 3;

			const { ts } = options;
			const ast = ts.createSourceFile('', content, 99 satisfies typeof ts.ScriptTarget.Latest);
			const literals: ts.StringLiteralLike[] = [];

			ts.forEachChild(ast, node => {
				if (
					!ts.isExpressionStatement(node) ||
					!isTemplateExpression(node.expression)
				) {
					return;
				}

				const expression = node.expression.templateSpans[0].expression;

				if (ts.isStringLiteralLike(expression)) {
					literals.push(expression);
				}

				if (ts.isArrayLiteralExpression(expression)) {
					walkArrayLiteral(expression);
				}

				if (ts.isObjectLiteralExpression(expression)) {
					walkObjectLiteral(expression);
				}
			});

			for (const literal of literals) {
				const classes = collectClasses(
					literal.text,
					literal.end - literal.text.length - 1 + startOffset
				);
				ctx.scopedClasses.push(...classes);
			}

			function walkArrayLiteral(node: ts.ArrayLiteralExpression) {
				const { elements } = node;
				for (const element of elements) {
					if (ts.isStringLiteralLike(element)) {
						literals.push(element);
					}
					else if (ts.isObjectLiteralExpression(element)) {
						walkObjectLiteral(element);
					}
				}
			}

			function walkObjectLiteral(node: ts.ObjectLiteralExpression) {
				const { properties } = node;
				for (const property of properties) {
					if (ts.isPropertyAssignment(property)) {
						const { name } = property;
						if (ts.isIdentifier(name)) {
							walkIdentifier(name);
						}
						else if (ts.isComputedPropertyName(name)) {
							const { expression } = name;
							if (ts.isStringLiteralLike(expression)) {
								literals.push(expression);
							}
						}
					}
					else if (ts.isShorthandPropertyAssignment(property)) {
						walkIdentifier(property.name);
					}
				}
			}

			function walkIdentifier(node: ts.Identifier) {
				ctx.scopedClasses.push({
					source: 'template',
					className: node.text,
					offset: node.end - node.text.length + startOffset
				});
			}
		}
	}
}

function camelizeComponentName(newName: string) {
	return camelize('-' + newName);
}

function getTagRenameApply(oldName: string) {
	return oldName === hyphenateTag(oldName) ? hyphenateTag : undefined;
}

function collectClasses(content: string, startOffset = 0) {
	const classes: {
		source: string;
		className: string;
		offset: number;
	}[] = [];

	let currentClassName = '';
	let offset = 0;
	for (const char of (content + ' ')) {
		if (char.trim() === '') {
			if (currentClassName !== '') {
				classes.push({
					source: 'template',
					className: currentClassName,
					offset: offset + startOffset
				});
				offset += currentClassName.length;
				currentClassName = '';
			}
			offset += char.length;
		}
		else {
			currentClassName += char;
		}
	}
	return classes;
}

// isTemplateExpression is missing in tsc
function isTemplateExpression(node: ts.Node): node is ts.TemplateExpression {
	return node.kind === 228 satisfies ts.SyntaxKind.TemplateExpression;
}
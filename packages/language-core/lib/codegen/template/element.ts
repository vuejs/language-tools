import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import { toString } from 'muggle-string';
import type * as ts from 'typescript';
import type { Code } from '../../types';
import { getElementTagOffsets, getNodeText, hyphenateTag, normalizeAttributeValue } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import { names } from '../names';
import { endOfLine, forEachNode, getTypeScriptAST, identifierRE, newLine } from '../utils';
import { Boundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import { generateStringLiteralKey } from '../utils/stringLiteralKey';
import type { TemplateCodegenContext } from './context';
import { generateElementDirectives } from './elementDirectives';
import { generateElementEvents } from './elementEvents';
import { type FailedPropExpressions, generateElementProps } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generatePropertyAccess } from './propertyAccess';
import { generateStyleScopedClassReference } from './styleScopedClasses';
import { generateTemplateChild } from './templateChild';
import { generateVSlot } from './vSlot';

export function* generateComponent(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	let { tag, props } = node;
	let [startTagOffset, endTagOffset] = getElementTagOffsets(node, options.template);
	let isExpression = false;
	let isIsShorthand = false;

	if (tag.includes('.')) {
		isExpression = true;
	}
	else if (tag === 'component') {
		for (const prop of node.props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'bind'
				&& prop.arg?.loc.source === 'is'
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				isIsShorthand = prop.arg.loc.end.offset === prop.exp.loc.end.offset;
				if (isIsShorthand) {
					ctx.inlayHints.push(createVBindShorthandInlayHintInfo(prop.exp.loc, 'is'));
				}
				isExpression = true;
				tag = prop.exp.content;
				startTagOffset = prop.exp.loc.start.offset;
				endTagOffset = undefined;
				props = props.filter(p => p !== prop);
				break;
			}
		}
	}

	const componentVar = ctx.getInternalVariable();

	if (isExpression) {
		yield `const ${componentVar} = `;
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			isIsShorthand
				? codeFeatures.withoutHighlightAndCompletion
				: codeFeatures.all,
			tag,
			startTagOffset,
			`(`,
			`)`,
		);
		if (endTagOffset !== undefined) {
			yield ` || `;
			yield* generateInterpolation(
				options,
				ctx,
				options.template,
				codeFeatures.withoutCompletion,
				tag,
				endTagOffset,
				`(`,
				`)`,
			);
		}
		yield `${endOfLine}`;
	}
	else {
		const originalNames = new Set([
			capitalize(camelize(tag)),
			camelize(tag),
			tag,
		]);
		const matchedSetupConst = [...originalNames].find(name => options.setupConsts.has(name));
		if (matchedSetupConst) {
			// navigation & auto import support
			yield `const ${componentVar} = `;
			yield* generateCamelized(
				matchedSetupConst[0]! + tag.slice(1),
				'template',
				startTagOffset,
				{
					...codeFeatures.withoutHighlightAndCompletion,
					...codeFeatures.importCompletionOnly,
				},
			);
			if (endTagOffset !== undefined) {
				yield ` || `;
				yield* generateCamelized(
					matchedSetupConst[0]! + tag.slice(1),
					'template',
					endTagOffset,
					codeFeatures.withoutHighlightAndCompletion,
				);
			}
			yield endOfLine;
		}
		else {
			yield `let ${componentVar}!: ${names.WithComponent}<'${tag}', ${names.LocalComponents}, ${names.GlobalComponents}`;
			yield originalNames.has(options.componentName)
				? `, typeof ${names.export}`
				: `, void`;
			for (const name of originalNames) {
				yield `, '${name}'`;
			}
			yield `>[`;
			yield* generateStringLiteralKey(
				tag,
				startTagOffset,
				{
					...codeFeatures.semanticWithoutHighlight,
					...options.vueCompilerOptions.checkUnknownComponents
						? codeFeatures.verification
						: codeFeatures.doNotReportTs2339AndTs2551,
				},
			);
			yield `]${endOfLine}`;

			if (identifierRE.test(camelize(tag))) {
				// navigation support
				yield `/** @ts-ignore @type {`;
				for (const offset of [startTagOffset, endTagOffset]) {
					if (offset === undefined) {
						continue;
					}
					yield ` | typeof ${names.components}.`;
					yield* generateCamelized(tag, 'template', offset, codeFeatures.navigation);
					if (tag[0] !== tag[0]!.toUpperCase()) {
						yield ` | typeof ${names.components}.`;
						yield* generateCamelized(capitalize(tag), 'template', offset, codeFeatures.navigation);
					}
					if (tag.includes('-')) {
						yield ` | typeof ${names.components}[`;
						yield* generateStringLiteralKey(tag, offset, codeFeatures.navigation);
						yield `]`;
					}
				}
				yield `} */${newLine}`;
				// auto import support
				yield* generateCamelized(tag, 'template', startTagOffset, codeFeatures.importCompletionOnly);
				yield endOfLine;
			}
		}
	}

	let isCtxVarUsed = false;
	let isPropsVarUsed = false;

	const getCtxVar = () => (isCtxVarUsed = true, ctxVar);
	const getPropsVar = () => (isPropsVarUsed = true, propsVar);
	ctx.components.push(getCtxVar);

	const functionalVar = ctx.getInternalVariable();
	const vnodeVar = ctx.getInternalVariable();
	const ctxVar = ctx.getInternalVariable();
	const propsVar = ctx.getInternalVariable();

	const failedPropExps: FailedPropExpressions[] = [];
	const propCodes = [...generateElementProps(
		options,
		ctx,
		node,
		props,
		options.vueCompilerOptions.checkUnknownProps,
		failedPropExps,
	)];
	const propsStr = toString(propCodes);

	yield `// @ts-ignore${newLine}`;
	yield `const ${functionalVar} = ${
		options.vueCompilerOptions.checkUnknownProps ? names.asFunctionalComponent0 : names.asFunctionalComponent1
	}(${componentVar}, new ${componentVar}({${newLine}`;
	yield propsStr;
	yield `}))${endOfLine}`;

	yield `const `;
	const boundary = yield* Boundary.start('template', node.loc.start.offset, codeFeatures.doNotReportTs6133);
	yield vnodeVar;
	yield boundary.end(node.loc.end.offset);
	yield ` = ${functionalVar}`;

	const commentInfo = ctx.getCommentInfo();
	if (commentInfo.generic) {
		const { content, offset } = commentInfo.generic;
		const boundary = yield* Boundary.start('template', offset, codeFeatures.verification);
		yield `<`;
		yield [content, 'template', offset, codeFeatures.all];
		yield `>`;
		yield boundary.end(offset + content.length);
	}

	const shouldInheritAttrs = hasVBindAttrs(options, ctx, node);

	yield `(`;
	const boundary2 = yield* Boundary.start(
		'template',
		startTagOffset,
		shouldInheritAttrs && options.vueCompilerOptions.checkRequiredFallthroughAttributes
			? {}
			: codeFeatures.verification,
	);
	yield `{`;
	yield [``, 'template', node.loc.start.offset, { __propsCompletion: true }];
	yield newLine;
	yield* propCodes;
	yield `}`;
	yield boundary2.end(startTagOffset + tag.length);
	yield `, ...${names.functionalComponentArgsRest}(${functionalVar}))${endOfLine}`;

	yield* generateFailedExpressions(options, ctx, failedPropExps);
	yield* generateElementEvents(
		options,
		ctx,
		node,
		componentVar,
		getCtxVar,
		getPropsVar,
	);
	yield* generateElementDirectives(options, ctx, node);

	const templateRef = getTemplateRef(node);
	const isSingleRoot = ctx.singleRootNodes.has(node)
		&& !options.vueCompilerOptions.fallthroughComponentNames.includes(hyphenateTag(tag));

	if (templateRef || isSingleRoot) {
		const componentInstanceVar = ctx.getInternalVariable();
		yield `var ${componentInstanceVar}!: Parameters<NonNullable<typeof ${getCtxVar()}['expose']>>[0]`;
		yield endOfLine;

		if (templateRef) {
			let typeExp = `typeof ${ctx.getHoistVariable(componentInstanceVar)} | null`;
			if (ctx.inVFor) {
				typeExp = `(${typeExp})[]`;
			}
			ctx.addTemplateRef(templateRef[0], typeExp, templateRef[1]);
		}
		if (isSingleRoot) {
			ctx.singleRootElTypes.add(`NonNullable<typeof ${componentInstanceVar}>['$el']`);
		}
	}

	if (shouldInheritAttrs) {
		if (options.vueCompilerOptions.checkRequiredFallthroughAttributes) {
			const restsVar = ctx.getInternalVariable();
			yield `var ${restsVar} = ${names.omit}(${getPropsVar()}, {\n${propsStr}})${endOfLine}`;
			ctx.inheritedAttrVars.add(restsVar);
		}
		else {
			ctx.inheritedAttrVars.add(getPropsVar());
		}
	}

	yield* generateStyleScopedClassReferences(options, node);

	const slotDir = node.props.find(CompilerDOM.isVSlot);
	if (slotDir || node.children.length) {
		yield* generateVSlot(options, ctx, node, slotDir, getCtxVar());
	}

	if (isCtxVarUsed) {
		yield `var ${ctxVar}!: ${names.ExtractComponentContext}<typeof ${componentVar}, typeof ${vnodeVar}>${endOfLine}`;
	}
	if (isPropsVarUsed) {
		yield `var ${propsVar}!: ${names.ExtractComponentProps}<typeof ${componentVar}, typeof ${vnodeVar}>${endOfLine}`;
	}
	ctx.components.pop();
}

export function* generateElement(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	const [startTagOffset, endTagOffset] = getElementTagOffsets(node, options.template);
	const failedPropExps: FailedPropExpressions[] = [];

	yield `${
		options.vueCompilerOptions.checkUnknownProps ? names.asFunctionalElement0 : names.asFunctionalElement1
	}(${names.intrinsics}`;
	yield* generatePropertyAccess(
		options,
		ctx,
		node.tag,
		startTagOffset,
		codeFeatures.withoutHighlightAndCompletion,
	);
	if (endTagOffset !== undefined) {
		yield `, `;
		yield names.intrinsics;
		yield* generatePropertyAccess(
			options,
			ctx,
			node.tag,
			endTagOffset,
			codeFeatures.withoutHighlightAndCompletion,
		);
	}
	yield `)(`;
	const boundary = yield* Boundary.start('template', startTagOffset, codeFeatures.verification);
	yield `{${newLine}`;
	yield* generateElementProps(
		options,
		ctx,
		node,
		node.props,
		options.vueCompilerOptions.checkUnknownProps,
		failedPropExps,
	);
	yield `}`;
	yield boundary.end(startTagOffset + node.tag.length);
	yield `)${endOfLine}`;

	yield* generateFailedExpressions(options, ctx, failedPropExps);
	yield* generateElementDirectives(options, ctx, node);

	const templateRef = getTemplateRef(node);
	if (templateRef) {
		let typeExp = `${names.Elements}['${node.tag}']`;
		if (ctx.inVFor) {
			typeExp += `[]`;
		}
		ctx.addTemplateRef(templateRef[0], typeExp, templateRef[1]);
	}
	if (ctx.singleRootNodes.has(node)) {
		ctx.singleRootElTypes.add(`${names.Elements}['${node.tag}']`);
	}

	if (hasVBindAttrs(options, ctx, node)) {
		ctx.inheritedAttrVars.add(`${names.intrinsics}.${node.tag}`);
	}

	yield* generateStyleScopedClassReferences(options, node);

	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child);
	}
}

export function* generateFragment(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	const [startTagOffset] = getElementTagOffsets(node, options.template);

	// special case for <template v-for="..." :key="..." />
	if (node.props.length) {
		yield `__VLS_asFunctionalElement(__VLS_intrinsics.template)(`;
		const boundary = yield* Boundary.start('template', startTagOffset, codeFeatures.verification);
		yield `{${newLine}`;
		yield* generateElementProps(
			options,
			ctx,
			node,
			node.props,
			options.vueCompilerOptions.checkUnknownProps,
		);
		yield `}`;
		yield boundary.end(startTagOffset + node.tag.length);
		yield `)${endOfLine}`;
	}

	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child);
	}
}

function* generateStyleScopedClassReferences(
	{ template, typescript: ts }: TemplateCodegenOptions,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& prop.name === 'class'
			&& prop.value
		) {
			const [text, start] = normalizeAttributeValue(prop.value);
			for (const [className, offset] of forEachClassName(text)) {
				yield* generateStyleScopedClassReference(template, className, start + offset);
			}
		}
		else if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			&& prop.arg.content === 'class'
		) {
			const content = '(' + prop.exp.content + ')';
			const startOffset = prop.exp.loc.start.offset - 1;
			const ast = getTypeScriptAST(ts, template, content);
			const literals: ts.StringLiteralLike[] = [];

			for (const node of forEachNode(ts, ast)) {
				if (
					!ts.isExpressionStatement(node)
					|| !ts.isParenthesizedExpression(node.expression)
				) {
					continue;
				}
				const { expression } = node.expression;

				if (ts.isStringLiteralLike(expression)) {
					literals.push(expression);
				}
				else if (ts.isArrayLiteralExpression(expression)) {
					yield* walkArrayLiteral(expression);
				}
				else if (ts.isObjectLiteralExpression(expression)) {
					yield* walkObjectLiteral(expression);
				}
			}

			for (const literal of literals) {
				const start = literal.end - literal.text.length - 1 + startOffset;
				for (const [className, offset] of forEachClassName(literal.text)) {
					yield* generateStyleScopedClassReference(template, className, start + offset);
				}
			}

			function* walkArrayLiteral(node: ts.ArrayLiteralExpression) {
				const { elements } = node;
				for (const element of elements) {
					if (ts.isStringLiteralLike(element)) {
						literals.push(element);
					}
					else if (ts.isObjectLiteralExpression(element)) {
						yield* walkObjectLiteral(element);
					}
				}
			}

			function* walkObjectLiteral(node: ts.ObjectLiteralExpression) {
				const { properties } = node;
				for (const property of properties) {
					if (ts.isPropertyAssignment(property)) {
						const { name } = property;
						if (ts.isIdentifier(name)) {
							const text = getNodeText(ts, name, ast);
							yield* generateStyleScopedClassReference(template, text, name.end - text.length + startOffset);
						}
						else if (ts.isStringLiteral(name)) {
							literals.push(name);
						}
						else if (ts.isComputedPropertyName(name)) {
							const { expression } = name;
							if (ts.isStringLiteralLike(expression)) {
								literals.push(expression);
							}
						}
					}
					else if (ts.isShorthandPropertyAssignment(property)) {
						const text = getNodeText(ts, property.name, ast);
						yield* generateStyleScopedClassReference(template, text, property.name.end - text.length + startOffset);
					}
				}
			}
		}
	}
}

function* forEachClassName(content: string) {
	let offset = 0;
	for (const className of content.split(' ')) {
		yield [className, offset] as const;
		offset += className.length + 1;
	}
}

function* generateFailedExpressions(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	failedPropExps: FailedPropExpressions[],
): Generator<Code> {
	for (const { node, prefix, suffix } of failedPropExps) {
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			codeFeatures.all,
			node.loc.source,
			node.loc.start.offset,
			prefix,
			suffix,
		);
		yield endOfLine;
	}
}

function getTemplateRef(node: CompilerDOM.ElementNode) {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& prop.name === 'ref'
			&& prop.value
		) {
			return normalizeAttributeValue(prop.value);
		}
	}
}

function hasVBindAttrs(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
) {
	return options.vueCompilerOptions.fallthroughAttributes && (
		(options.inheritAttrs && ctx.singleRootNodes.has(node))
		|| node.props.some(prop =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& prop.exp?.loc.source === '$attrs'
		)
	);
}

import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import { toString } from 'muggle-string';
import type * as ts from 'typescript';
import type { Code, VueCodeInformation } from '../../types';
import { getElementTagOffsets, hyphenateTag, normalizeAttributeValue } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import * as names from '../names';
import { endOfLine, forEachNode, getTypeScriptAST, identifierRegex, newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import type { TemplateCodegenContext } from './context';
import { generateElementDirectives } from './elementDirectives';
import { generateElementEvents } from './elementEvents';
import { type FailGeneratedExpression, generateElementProps } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generatePropertyAccess } from './propertyAccess';
import { generateStyleScopedClassReference } from './styleScopedClasses';
import { generateTemplateChild } from './templateChild';
import { generateVSlot } from './vSlot';

const colonReg = /:/g;

export function* generateComponent(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	const tagOffsets = getElementTagOffsets(node, options.template);
	const failGeneratedExpressions: FailGeneratedExpression[] = [];
	const possibleOriginalNames = getPossibleOriginalComponentNames(node.tag, true);
	const matchConst = possibleOriginalNames.find(name => options.setupConsts.has(name));
	const componentOriginalVar = matchConst ?? ctx.getInternalVariable();
	const componentFunctionalVar = ctx.getInternalVariable();
	const componentVNodeVar = ctx.getInternalVariable();
	const componentCtxVar = ctx.getInternalVariable();
	const componentPropsVar = ctx.getInternalVariable();
	const isComponentTag = node.tag.toLowerCase() === 'component';

	let isCtxVarUsed = false;
	let isPropsVarUsed = false;
	ctx.currentComponent = {
		get ctxVar() {
			isCtxVarUsed = true;
			return componentCtxVar;
		},
		get propsVar() {
			isPropsVarUsed = true;
			return componentPropsVar;
		},
	};

	let props = node.props;
	let dynamicTagInfo: {
		tag: string;
		offsets: [number] | [number, number];
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
		};
	}

	if (matchConst) {
		// navigation support
		yield `/** @type {[`;
		for (const tagOffset of tagOffsets) {
			yield `typeof `;
			if (componentOriginalVar === node.tag) {
				yield [
					componentOriginalVar,
					'template',
					tagOffset,
					codeFeatures.withoutHighlightAndCompletion,
				];
			}
			else {
				const shouldCapitalize = matchConst[0]!.toUpperCase() === matchConst[0];
				yield* generateCamelized(
					shouldCapitalize ? capitalize(node.tag) : node.tag,
					'template',
					tagOffset,
					codeFeatures.withoutHighlightAndCompletion,
				);
			}
			yield `, `;
		}
		yield `]} */${endOfLine}`;

		// auto import support
		yield `// @ts-ignore${newLine}`; // #2304
		yield* generateCamelized(capitalize(node.tag), 'template', tagOffsets[0], codeFeatures.importCompletionOnly);
		yield endOfLine;
	}
	else if (dynamicTagInfo) {
		yield `const ${componentOriginalVar} = (`;
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			codeFeatures.all,
			dynamicTagInfo.tag,
			dynamicTagInfo.offsets[0],
			`(`,
			`)`,
		);
		if (dynamicTagInfo.offsets[1] !== undefined) {
			yield `,`;
			yield* generateInterpolation(
				options,
				ctx,
				options.template,
				codeFeatures.withoutCompletion,
				dynamicTagInfo.tag,
				dynamicTagInfo.offsets[1],
				`(`,
				`)`,
			);
		}
		yield `)${endOfLine}`;
	}
	else {
		yield `const ${componentOriginalVar} = ({} as __VLS_WithComponent<'${
			getCanonicalComponentName(node.tag)
		}', __VLS_LocalComponents, `;
		if (options.selfComponentName && possibleOriginalNames.includes(options.selfComponentName)) {
			yield `typeof ${names._export}, `;
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
			{
				...codeFeatures.semanticWithoutHighlight,
				...options.vueCompilerOptions.checkUnknownComponents
					? codeFeatures.verification
					: codeFeatures.doNotReportTs2339AndTs2551,
			},
		);
		yield endOfLine;

		const camelizedTag = camelize(node.tag);
		if (identifierRegex.test(camelizedTag)) {
			// navigation support
			yield `/** @type {[`;
			for (const tagOffset of tagOffsets) {
				for (const shouldCapitalize of (node.tag[0] === node.tag[0]!.toUpperCase() ? [false] : [true, false])) {
					yield `typeof ${names.components}.`;
					yield* generateCamelized(
						shouldCapitalize ? capitalize(node.tag) : node.tag,
						'template',
						tagOffset,
						codeFeatures.navigation,
					);
					yield `, `;
				}
			}
			yield `]} */${endOfLine}`;

			// auto import support
			yield `// @ts-ignore${newLine}`; // #2304
			yield* generateCamelized(capitalize(node.tag), 'template', tagOffsets[0], codeFeatures.importCompletionOnly);
			yield endOfLine;
		}
	}

	const propCodes = [...generateElementProps(
		options,
		ctx,
		node,
		props,
		options.vueCompilerOptions.checkUnknownProps,
		failGeneratedExpressions,
	)];

	yield `// @ts-ignore${newLine}`;
	yield `const ${componentFunctionalVar} = __VLS_asFunctionalComponent(${componentOriginalVar}, new ${componentOriginalVar}({${newLine}`;
	yield* toString(propCodes);
	yield `}))${endOfLine}`;

	yield `const `;
	const token = yield* startBoundary('template', node.loc.start.offset, codeFeatures.doNotReportTs6133);
	yield componentVNodeVar;
	yield endBoundary(token, node.loc.end.offset);
	yield ` = ${componentFunctionalVar}`;
	yield* generateComponentGeneric(ctx);
	yield `(`;
	const token2 = yield* startBoundary('template', tagOffsets[0], codeFeatures.verification);
	yield `{${newLine}`;
	yield* propCodes;
	yield `}`;
	yield endBoundary(token2, tagOffsets[0] + node.tag.length);
	yield `, ...__VLS_functionalComponentArgsRest(${componentFunctionalVar}))${endOfLine}`;

	yield* generateFailedExpressions(options, ctx, failGeneratedExpressions);
	yield* generateElementEvents(
		options,
		ctx,
		node,
		componentOriginalVar,
	);
	yield* generateElementDirectives(options, ctx, node);

	const templateRef = getTemplateRef(node);
	const tag = hyphenateTag(node.tag);
	const isRootNode = ctx.singleRootNodes.has(node)
		&& !options.vueCompilerOptions.fallthroughComponentNames.includes(tag);

	if (templateRef || isRootNode) {
		const componentInstanceVar = ctx.getInternalVariable();
		isCtxVarUsed = true;

		yield `var ${componentInstanceVar} = {} as (Parameters<NonNullable<typeof ${componentCtxVar}['expose']>>[0] | null)`;
		if (ctx.inVFor) {
			yield `[]`;
		}
		yield endOfLine;

		if (templateRef) {
			const typeExp = `typeof ${ctx.getHoistVariable(componentInstanceVar)}`;
			ctx.addTemplateRef(templateRef[0], typeExp, templateRef[1]);
		}
		if (isRootNode) {
			ctx.singleRootElTypes.add(`NonNullable<typeof ${componentInstanceVar}>['$el']`);
		}
	}

	if (hasVBindAttrs(options, ctx, node)) {
		ctx.inheritedAttrVars.add(componentPropsVar);
		isPropsVarUsed = true;
	}

	yield* generateStyleScopedClassReferences(options, node);

	const slotDir = node.props.find(p =>
		p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot'
	) as CompilerDOM.DirectiveNode;
	yield* generateVSlot(options, ctx, node, slotDir);

	if (isCtxVarUsed) {
		yield `var ${componentCtxVar}!: __VLS_FunctionalComponentCtx<typeof ${componentOriginalVar}, typeof ${componentVNodeVar}>${endOfLine}`;
	}

	if (isPropsVarUsed) {
		yield `var ${componentPropsVar}!: __VLS_FunctionalComponentProps<typeof ${componentOriginalVar}, typeof ${componentVNodeVar}>${endOfLine}`;
	}
}

export function* generateElement(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	const [startTagOffset, endTagOffset] = getElementTagOffsets(node, options.template);
	const failedPropExps: FailGeneratedExpression[] = [];

	yield `__VLS_asFunctionalElement(${names.intrinsics}`;
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
	const token = yield* startBoundary('template', startTagOffset, codeFeatures.verification);
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
	yield endBoundary(token, startTagOffset + node.tag.length);
	yield `)${endOfLine}`;

	yield* generateFailedExpressions(options, ctx, failedPropExps);
	yield* generateElementDirectives(options, ctx, node);

	const templateRef = getTemplateRef(node);
	if (templateRef) {
		let typeExp = `__VLS_Elements['${node.tag}']`;
		if (ctx.inVFor) {
			typeExp += `[]`;
		}
		ctx.addTemplateRef(templateRef[0], typeExp, templateRef[1]);
	}
	if (ctx.singleRootNodes.has(node)) {
		ctx.singleRootElTypes.add(`__VLS_Elements['${node.tag}']`);
	}

	if (hasVBindAttrs(options, ctx, node)) {
		ctx.inheritedAttrVars.add(`__VLS_intrinsics.${node.tag}`);
	}

	yield* generateStyleScopedClassReferences(options, node);

	const { currentComponent } = ctx;
	ctx.currentComponent = undefined;
	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child);
	}
	ctx.currentComponent = currentComponent;
}

function* generateStyleScopedClassReferences(
	{ template, ts }: TemplateCodegenOptions,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.ATTRIBUTE
			&& prop.name === 'class'
			&& prop.value
		) {
			if (template.lang === 'pug') {
				const getClassOffset = Reflect.get(prop.value.loc.start, 'getClassOffset') as (offset: number) => number;
				const content = prop.value.loc.source.slice(1, -1);
				for (const [className, pos] of forEachClassName(content)) {
					yield* generateStyleScopedClassReference(template, className, getClassOffset(pos + 1));
				}
			}
			else {
				const [text, start] = normalizeAttributeValue(prop.value);
				for (const [className, offset] of forEachClassName(text)) {
					yield* generateStyleScopedClassReference(template, className, start + offset);
				}
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
							yield* generateStyleScopedClassReference(
								template,
								name.text,
								name.end - name.text.length + startOffset,
							);
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
						yield* generateStyleScopedClassReference(
							template,
							property.name.text,
							property.name.end - property.name.text.length + startOffset,
						);
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
	failGeneratedExpressions: FailGeneratedExpression[],
): Generator<Code> {
	for (const failedExp of failGeneratedExpressions) {
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			codeFeatures.all,
			failedExp.node.loc.source,
			failedExp.node.loc.start.offset,
			failedExp.prefix,
			failedExp.suffix,
		);
		yield endOfLine;
	}
}

function getCanonicalComponentName(tagText: string) {
	return identifierRegex.test(tagText)
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

function* generateCanonicalComponentName(
	tagText: string,
	offset: number,
	features: VueCodeInformation,
): Generator<Code> {
	if (identifierRegex.test(tagText)) {
		yield [tagText, 'template', offset, features];
	}
	else {
		yield* generateCamelized(
			capitalize(tagText.replace(colonReg, '-')),
			'template',
			offset,
			features,
		);
	}
}

function* generateComponentGeneric(
	ctx: TemplateCodegenContext,
): Generator<Code> {
	if (ctx.currentInfo.generic) {
		const { content, offset } = ctx.currentInfo.generic;
		const token = yield* startBoundary('template', offset, codeFeatures.verification);
		yield `<`;
		yield [content, 'template', offset, codeFeatures.all];
		yield `>`;
		yield endBoundary(token, offset + content.length);
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

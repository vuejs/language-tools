import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import { toString } from 'muggle-string';
import type { Code } from '../../types';
import { getElementTagOffsets, hyphenateTag, normalizeAttributeValue } from '../../utils/shared';
import { codeFeatures, VueCodeFeature } from '../codeFeatures';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import { names } from '../names';
import { generateExportDeclareEqual } from '../script';
import { endOfLine, generateTypedVar, identifierRE, newLine } from '../utils';
import { Boundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import { generateStringLiteralKey } from '../utils/stringLiteralKey';
import type { TemplateCodegenContext } from './context';
import { generateElementDirectives } from './elementDirectives';
import { generateElementEvents } from './elementEvents';
import { type FailedPropExpressions, generateElementProps } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateIdentifier, generateInterpolation } from './interpolation';
import { generatePropertyAccess } from './propertyAccess';
import { generateStyleScopedClassReferences } from './styleScopedClasses';
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
		// Like `@vue/compiler-sfc`, a tag refers to the setup binding of its name, whatever it is imported from;
		// referencing it like a template expression keeps navigation and auto import support.
		const matchedBinding = [...originalNames].find(name => options.setupBindings.has(name));
		if (matchedBinding) {
			const camelizedTag = matchedBinding[0]! + tag.slice(1);
			yield `const ${componentVar} = `;
			yield* generateIdentifier(
				options,
				ctx,
				generateCamelized(camelizedTag, 'template', startTagOffset, codeFeatures.tagName),
				matchedBinding,
				'template',
				startTagOffset,
				startTagOffset + tag.length,
			);
			if (endTagOffset !== undefined) {
				yield ` || `;
				yield* generateIdentifier(
					options,
					ctx,
					generateCamelized(camelizedTag, 'template', endTagOffset, codeFeatures.tagName),
					matchedBinding,
					'template',
					endTagOffset,
					endTagOffset + tag.length,
				);
			}
			yield endOfLine;
		}
		else {
			yield* generateTypedVar('let', componentVar, options.scriptLang, function*() {
				yield `${names.WithComponent}<'${tag}', ${names.LocalComponents}, ${names.GlobalComponents}`;
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
					codeFeatures.semanticWithoutHighlight | codeFeatures.verification,
				);
				yield `]`;
			});

			if (identifierRE.test(camelize(tag))) {
				// navigation support; TypeScript does not check the type of a JSDoc on an expression statement
				yield `/** @type {`;
				for (const offset of [startTagOffset, endTagOffset]) {
					if (offset === undefined) {
						continue;
					}
					for (const name of new Set([tag, capitalize(tag)])) {
						yield ` | typeof ${options.setupBindings.has(camelize(name)) ? '' : `${names.components}.`}`;
						yield* generateCamelized(name, 'template', offset, codeFeatures.navigation);
					}
					if (tag.includes('-')) {
						yield ` | typeof ${names.components}[`;
						yield* generateStringLiteralKey(tag, offset, codeFeatures.navigation);
						yield `]`;
					}
				}
				yield `} */${newLine}`;
				yield `${componentVar}${endOfLine}`;
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
		failedPropExps,
	)];
	const propsStr = toString(propCodes);

	// The instance type comes from a real construct call with a copy of the props: only a call resolves the
	// overloads of the component and infers its type parameters from the props, including intersections of
	// construct signatures such as `DefineComponent<...> & (new <T>(props: { items: T[] }, slots) => ...)` of
	// Vuetify's `genericComponent`. Inferring from the constructor type alone takes the last overload and loses
	// the type parameters of intersections. The two `@ts-ignore`s cover what the call reports for valid templates:
	// - components that are not constructable (functional components, plain objects, `{}`) or abstract;
	// - construct signatures of other arities (`new () => ...`, Vuetify's `(props, slots)`);
	// - excess or weakly matching props, since attributes and events are passed along with the props;
	// - diagnostics of the copy itself: its expressions have the parameter types of the constructor as contextual
	//   type (`any` for `DefineComponent`), so function expressions report implicit `any`, and typing it like
	//   `$props` instead would report every props error a second time. The copy is not mapped to the template.
	yield `// @ts-ignore${newLine}`;
	yield `const ${functionalVar} = ${names.asFunctionalComponent0}(${componentVar}, new ${componentVar}({${newLine}`;
	// unmapped copy for inference only
	yield propsStr;
	yield `}))${endOfLine}`;

	yield* generateExportDeclareEqual(options.template.name, vnodeVar, node.loc.start.offset, node.loc.end.offset);
	yield functionalVar;

	const commentInfo = ctx.getCommentInfo();
	if (commentInfo.generic) {
		const { content, offset } = commentInfo.generic;
		const boundary = yield* Boundary.start(
			'template',
			offset,
			offset + content.length,
			codeFeatures.verification,
		);
		yield `<`;
		yield [content, 'template', offset, codeFeatures.all];
		yield `>`;
		yield boundary.end();
	}

	const shouldInheritAttrs = hasVBindAttrs(options, ctx, node);

	yield `(`;
	const boundary2 = yield* Boundary.start(
		'template',
		startTagOffset,
		startTagOffset + tag.length,
		shouldInheritAttrs && options.vueCompilerOptions.checkRequiredFallthroughAttributes
			? 0
			: codeFeatures.verification,
	);
	yield `{`;
	yield [``, 'template', node.loc.start.offset, VueCodeFeature.PropsCompletion];
	yield newLine;
	yield* propCodes;
	yield `}`;
	yield boundary2.end();
	yield `, ...${names.functionalComponentArgsRest}(${functionalVar}))${endOfLine}`;
	yield `void ${vnodeVar}${endOfLine}`;

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
	const inferRootEl = ctx.dollarVars.has('$el') || options.vueCompilerOptions.inferComponentDollarEl;
	const inferTemplateRefs = options.vueCompilerOptions.inferTemplateDollarRefs
		|| options.vueCompilerOptions.inferComponentDollarRefs
		|| options.setupRefs.size > 0;

	if ((templateRef && inferTemplateRefs) || (isSingleRoot && inferRootEl)) {
		const componentInstanceVar = ctx.getInternalVariable();
		yield* generateTypedVar('var', componentInstanceVar, options.scriptLang, function*() {
			yield `Parameters<NonNullable<typeof ${getCtxVar()}['expose']>>[0]`;
		});

		if (templateRef && inferTemplateRefs) {
			let typeExp = `typeof ${ctx.getHoistVariable(componentInstanceVar)} | null`;
			if (ctx.inVFor) {
				typeExp = `(${typeExp})[]`;
			}
			ctx.addTemplateRef(templateRef[0], typeExp, templateRef[1]);
		}
		if (isSingleRoot && inferRootEl) {
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
	const hasSlots = !!slotDir || node.children.length > 0;

	// declared ahead of the slot code that reads them: JS has no `var x!: T`,
	// so a later declaration would be read before assignment (TS2454)
	if (isCtxVarUsed || hasSlots) {
		yield* generateTypedVar('var', ctxVar, options.scriptLang, function*() {
			yield `${names.ExtractComponentContext}<typeof ${componentVar}, typeof ${vnodeVar}>`;
		});
	}
	if (isPropsVarUsed) {
		yield* generateTypedVar('var', propsVar, options.scriptLang, function*() {
			yield `${names.ExtractComponentProps}<typeof ${componentVar}, typeof ${vnodeVar}>`;
		});
	}

	if (hasSlots) {
		yield* generateVSlot(options, ctx, node, slotDir, ctxVar);
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

	yield `${names.asFunctionalElement0}(${names.intrinsics}`;
	yield* generatePropertyAccess(
		options,
		ctx,
		node.tag,
		startTagOffset,
		codeFeatures.tagName,
	);
	if (endTagOffset !== undefined) {
		yield `, `;
		yield names.intrinsics;
		yield* generatePropertyAccess(
			options,
			ctx,
			node.tag,
			endTagOffset,
			codeFeatures.tagName,
		);
	}
	yield `)(`;
	const boundary = yield* Boundary.start(
		'template',
		startTagOffset,
		startTagOffset + node.tag.length,
		codeFeatures.verification,
	);
	yield `{${newLine}`;
	yield* generateElementProps(
		options,
		ctx,
		node,
		node.props,
		failedPropExps,
		`typeof ${names.intrinsics}['${node.tag}']`,
	);
	yield `}`;
	yield boundary.end();
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
	if (
		ctx.singleRootNodes.has(node) && (ctx.dollarVars.has('$el') || options.vueCompilerOptions.inferComponentDollarEl)
	) {
		ctx.singleRootElTypes.add(`${names.Elements}['${node.tag}']`);
	}

	if (hasVBindAttrs(options, ctx, node)) {
		ctx.inheritedAttrVars.add(`${names.intrinsics}.${node.tag}`);
	}

	yield* generateStyleScopedClassReferences(options, node);

	yield* ctx.generateDiagnosticDirectiveEnd();
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
	const failedPropExps: FailedPropExpressions[] = [];

	// special case for <template v-for="..." :key="..." />
	if (node.props.length) {
		yield `${names.asFunctionalElement0}(${names.intrinsics}.template)(`;
		const boundary = yield* Boundary.start(
			'template',
			startTagOffset,
			startTagOffset + node.tag.length,
			codeFeatures.verification,
		);
		yield `{${newLine}`;
		yield* generateElementProps(
			options,
			ctx,
			node,
			node.props,
			failedPropExps,
			`typeof ${names.intrinsics}.template`,
		);
		yield `}`;
		yield boundary.end();
		yield `)${endOfLine}`;

		yield* generateFailedExpressions(options, ctx, failedPropExps);
	}

	yield* ctx.generateDiagnosticDirectiveEnd();
	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child);
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

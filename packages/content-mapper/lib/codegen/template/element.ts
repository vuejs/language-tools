import * as CompilerDOM from '@vue/compiler-dom';
import {
	codeToString,
	completionFeatures,
	getComponentIsBinding,
	getElementTagOffsets,
	getTemplateRef,
	navigationFeatures,
	scriptFeatures,
	semanticFeatures,
} from '@vue/language-core';
import { camelize, capitalize } from '@vue/shared';
import { names } from '../names';
import { generateExportDeclareEqual } from '../script';
import { Boundary, mapped, synthesizedIgnore, type TsCode, type TsPiece } from '../tsCode';
import { endOfLine, generateTypedVar, identifierRE, newLine, typeAliasRef } from '../writers';
import { generateCamelized } from '../writers/camelized';
import { generateStringLiteralKey } from '../writers/stringLiteralKey';
import type { TemplateCodegenContext } from './context';
import { generateElementDirectives } from './elementDirectives';
import { generateElementEvents } from './elementEvents';
import { type FailedPropExpressions, generateElementProps } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateIdentifier, generateInterpolation } from './interpolation';
import { generatePropertyAccess } from './propertyAccess';
import { generateTemplateChild } from './templateChild';
import { generateVSlot } from './vSlot';

/** The slots of the code of the elements of the template. */
export interface ElementSlots {
	/** Code after the props of a component or a native element, before its children. */
	elementEnd: Map<CompilerDOM.ElementNode, TsCode[]>;
}

export function* generateComponent(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<TsCode> {
	let { tag, props } = node;
	let [startTagOffset, endTagOffset] = getElementTagOffsets(node, options.template);
	let isExpression = false;
	let isIsShorthand = false;

	if (tag.includes('.')) {
		isExpression = true;
	}
	else {
		const isBinding = getComponentIsBinding(node);
		if (isBinding) {
			const { prop, arg, exp } = isBinding;
			isIsShorthand = arg.loc.end.offset === exp.loc.end.offset;
			isExpression = true;
			tag = exp.content;
			startTagOffset = exp.loc.start.offset;
			endTagOffset = undefined;
			props = props.filter(p => p !== prop);
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
				? { features: semanticFeatures | navigationFeatures }
				: { features: scriptFeatures },
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
				{ features: scriptFeatures & ~completionFeatures },
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
				generateCamelized(camelizedTag, options.template, startTagOffset, {
					features: semanticFeatures | navigationFeatures,
				}),
				ctx.getExpression(options.template, startTagOffset, matchedBinding).references[0]!,
				options.template,
				startTagOffset,
				startTagOffset + tag.length,
			);
			if (endTagOffset !== undefined) {
				yield ` || `;
				yield* generateIdentifier(
					options,
					ctx,
					generateCamelized(camelizedTag, options.template, endTagOffset, {
						features: semanticFeatures | navigationFeatures,
					}),
					ctx.getExpression(options.template, endTagOffset, matchedBinding).references[0]!,
					options.template,
					endTagOffset,
					endTagOffset + tag.length,
				);
			}
			yield endOfLine;
		}
		else {
			yield* generateTypedVar('let', componentVar, options.scriptLang, function*() {
				yield `${names.WithComponent}<'${tag}', ${typeAliasRef(names.LocalComponents, options.scriptLang)}, ${
					typeAliasRef(names.GlobalComponents, options.scriptLang)
				}`;
				yield originalNames.has(options.componentName)
					? `, typeof ${names.export}`
					: `, void`;
				for (const name of originalNames) {
					yield `, '${name}'`;
				}
				yield `>[`;
				yield* generateStringLiteralKey(
					tag,
					options.template,
					startTagOffset,
					{ features: semanticFeatures },
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
						const ignore = yield* Boundary.start(options.template, 0, 0, synthesizedIgnore);
						yield* generateCamelized(name, options.template, offset, { features: navigationFeatures });
						yield ignore.end();
					}
					if (tag.includes('-')) {
						yield ` | typeof ${names.components}[`;
						const ignore = yield* Boundary.start(options.template, 0, 0, synthesizedIgnore);
						yield* generateStringLiteralKey(tag, options.template, offset, { features: navigationFeatures });
						yield ignore.end();
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
	const propsStr = codeToString(propCodes as TsPiece[]);

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

	yield* generateExportDeclareEqual(options.template, vnodeVar, node.loc.start.offset, node.loc.end.offset);
	yield functionalVar;

	const commentInfo = ctx.getCommentInfo();
	if (commentInfo.generic) {
		const { content, offset } = commentInfo.generic;
		const boundary = yield* Boundary.start(
			options.template,
			offset,
			offset + content.length,
			{ features: 0 },
		);
		yield `<`;
		yield mapped(content, options.template, offset, { features: scriptFeatures });
		yield `>`;
		yield boundary.end();
	}

	const shouldInheritAttrs = hasVBindAttrs(options, node);

	yield `(`;
	const boundary2 = yield* Boundary.start(options.template, startTagOffset, startTagOffset + tag.length, {
		features: 0,
	});
	if (shouldInheritAttrs && options.vueCompilerOptions.checkRequiredFallthroughAttributes) {
		// the props the fallthrough attributes supply are reported missing at the start of the object
		const ignore = yield* Boundary.start(options.template, 0, 0, synthesizedIgnore);
		yield `{`;
		yield ignore.end();
	}
	else {
		yield `{`;
	}
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

	const hasTemplateRef = !!getTemplateRef(node) && (
		options.vueCompilerOptions.inferTemplateDollarRefs
		|| options.vueCompilerOptions.inferComponentDollarRefs
		|| options.setupRefs.size > 0
	);
	const isRootEl = options.templateScope.rootElements.includes(node)
		&& (options.templateScope.dollarVars.has('$el') || options.vueCompilerOptions.inferComponentDollarEl);

	if (hasTemplateRef || isRootEl) {
		const instanceVar = ctx.getInternalVariable();
		yield* generateTypedVar('var', instanceVar, options.scriptLang, function*() {
			yield `Parameters<NonNullable<typeof ${getCtxVar()}['expose']>>[0]`;
		});
		ctx.componentInstanceVars.set(node, {
			instanceVar,
			hoistedVar: hasTemplateRef ? ctx.getHoistVariable(instanceVar) : undefined,
		});
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

	yield* options.slots.elementEnd.get(node) ?? [];

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
): Generator<TsCode> {
	const [startTagOffset, endTagOffset] = getElementTagOffsets(node, options.template);
	const failedPropExps: FailedPropExpressions[] = [];

	yield `${names.asFunctionalElement0}(${names.intrinsics}`;
	yield* generatePropertyAccess(
		options,
		ctx,
		node.tag,
		startTagOffset,
		{ features: semanticFeatures | navigationFeatures },
	);
	if (endTagOffset !== undefined) {
		yield `, `;
		yield names.intrinsics;
		yield* generatePropertyAccess(
			options,
			ctx,
			node.tag,
			endTagOffset,
			{ features: semanticFeatures | navigationFeatures },
		);
	}
	yield `)(`;
	const boundary = yield* Boundary.start(
		options.template,
		startTagOffset,
		startTagOffset + node.tag.length,
		{ features: 0 },
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

	if (hasVBindAttrs(options, node)) {
		ctx.inheritedAttrVars.add(`${names.intrinsics}.${node.tag}`);
	}

	yield* options.slots.elementEnd.get(node) ?? [];

	yield* ctx.generateDiagnosticDirectiveEnd();
	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child);
	}
}

export function* generateFragment(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<TsCode> {
	const [startTagOffset] = getElementTagOffsets(node, options.template);
	const failedPropExps: FailedPropExpressions[] = [];

	// special case for <template v-for="..." :key="..." />
	if (node.props.length) {
		yield `${names.asFunctionalElement0}(${names.intrinsics}.template)(`;
		const boundary = yield* Boundary.start(
			options.template,
			startTagOffset,
			startTagOffset + node.tag.length,
			{ features: 0 },
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
): Generator<TsCode> {
	for (const { node, prefix, suffix } of failedPropExps) {
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			{ features: scriptFeatures },
			node.loc.source,
			node.loc.start.offset,
			prefix,
			suffix,
		);
		yield endOfLine;
	}
}

function hasVBindAttrs(options: TemplateCodegenOptions, node: CompilerDOM.ElementNode) {
	return options.vueCompilerOptions.fallthroughAttributes && (
		(options.inheritAttrs && options.templateScope.singleRootNodes.has(node))
		|| node.props.some(prop =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& prop.exp?.loc.source === '$attrs'
		)
	);
}

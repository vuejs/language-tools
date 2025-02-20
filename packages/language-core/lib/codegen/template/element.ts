import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import type { Code, VueCodeInformation } from '../../types';
import { getSlotsPropertyName, hyphenateTag } from '../../utils/shared';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import { endOfLine, newLine, normalizeAttributeValue, variableNameRegex, wrapWith } from '../utils';
import { generateCamelized } from '../utils/camelized';
import type { TemplateCodegenContext } from './context';
import { generateElementChildren } from './elementChildren';
import { generateElementDirectives } from './elementDirectives';
import { generateElementEvents } from './elementEvents';
import { type FailedPropExpression, generateElementProps } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generatePropertyAccess } from './propertyAccess';
import { collectStyleScopedClassReferences } from './styleScopedClasses';
import { generateImplicitDefaultSlot, generateVSlot } from './vSlot';

const colonReg = /:/g;

export function* generateComponent(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	isVForChild: boolean
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
	const componentOriginalVar = matchImportName ?? ctx.getInternalVariable();
	const componentFunctionalVar = ctx.getInternalVariable();
	const componentVNodeVar = ctx.getInternalVariable();
	const componentCtxVar = ctx.getInternalVariable();
	const isComponentTag = node.tag.toLowerCase() === 'component';

	ctx.currentComponent = {
		ctxVar: componentCtxVar,
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
		// navigation support
		yield `/** @type {[`;
		for (const tagOffset of tagOffsets) {
			yield `typeof `;
			if (componentOriginalVar === node.tag) {
				yield [
					componentOriginalVar,
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
		yield `]} */${endOfLine}`;
	}
	else if (dynamicTagInfo) {
		yield `const ${componentOriginalVar} = (`;
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
				ctx.codeFeatures.withoutCompletion,
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
		yield `const ${componentOriginalVar} = ({} as __VLS_WithComponent<'${getCanonicalComponentName(node.tag)}', __VLS_LocalComponents, `;
		if (options.selfComponentName && possibleOriginalNames.includes(options.selfComponentName)) {
			yield `typeof __VLS_self & (new () => { `
				+ getSlotsPropertyName(options.vueCompilerOptions.target)
				+ `: __VLS_Slots }), `;
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
			// navigation support
			yield `/** @type {[`;
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
			yield `]} */${endOfLine}`;
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
		yield `const ${componentOriginalVar} = {} as any${endOfLine}`;
	}

	yield `// @ts-ignore${newLine}`;
	yield `const ${componentFunctionalVar} = __VLS_asFunctionalComponent(${componentOriginalVar}, new ${componentOriginalVar}({${newLine}`;
	yield* generateElementProps(
		options,
		ctx,
		node,
		props,
		options.vueCompilerOptions.checkUnknownProps,
		false
	);
	yield `}))${endOfLine}`;

	yield `const `;
	yield* wrapWith(
		node.loc.start.offset,
		node.loc.end.offset,
		ctx.resolveCodeFeatures({
			verification: {
				shouldReport(_source, code) {
					// https://typescript.tv/errors/#ts6133
					return String(code) !== '6133';
				},
			}
		}),
		componentVNodeVar
	);
	yield ` = ${componentFunctionalVar}`;
	yield* generateComponentGeneric(ctx);
	yield `(`;
	yield* wrapWith(
		tagOffsets[0],
		tagOffsets[0] + node.tag.length,
		ctx.codeFeatures.verification,
		`{${newLine}`,
		...generateElementProps(
			options,
			ctx,
			node,
			props,
			options.vueCompilerOptions.checkUnknownProps,
			true,
			failedPropExps
		),
		`}`
	);
	yield `, ...__VLS_functionalComponentArgsRest(${componentFunctionalVar}))${endOfLine}`;

	yield* generateFailedPropExps(options, ctx, failedPropExps);
	yield* generateElementEvents(options, ctx, node, componentFunctionalVar, componentVNodeVar, componentCtxVar);
	yield* generateElementDirectives(options, ctx, node);

	const [refName, offset] = yield* generateElementReference(options, ctx, node);
	const tag = hyphenateTag(node.tag);
	const isRootNode = ctx.singleRootNodes.has(node) && !options.vueCompilerOptions.fallthroughComponentNames.includes(tag);

	if (refName || isRootNode) {
		const componentInstanceVar = ctx.getInternalVariable();
		ctx.currentComponent.used = true;

		yield `var ${componentInstanceVar} = {} as (Parameters<NonNullable<typeof ${componentCtxVar}['expose']>>[0] | null)`;
		if (isVForChild) {
			yield `[]`;
		}
		yield `${endOfLine}`;

		if (refName && offset) {
			ctx.templateRefs.set(refName, {
				typeExp: `typeof ${ctx.getHoistVariable(componentInstanceVar)}`,
				offset
			});
		}
		if (isRootNode) {
			ctx.singleRootElTypes.push(`NonNullable<typeof ${componentInstanceVar}>['$el']`);
		}
	}

	if (hasVBindAttrs(options, ctx, node)) {
		const attrsVar = ctx.getInternalVariable();
		yield `let ${attrsVar}!: Parameters<typeof ${componentFunctionalVar}>[0]${endOfLine}`;
		ctx.inheritedAttrVars.add(attrsVar);
	}

	collectStyleScopedClassReferences(options, ctx, node);

	const slotDir = node.props.find(p => p.type === CompilerDOM.NodeTypes.DIRECTIVE && p.name === 'slot') as CompilerDOM.DirectiveNode;
	if (slotDir) {
		yield* generateVSlot(options, ctx, node, slotDir);
	}
	else {
		// #932: reference for default slot
		yield* generateImplicitDefaultSlot(ctx, node);
		yield* generateElementChildren(options, ctx, node);
	}

	if (ctx.currentComponent.used) {
		yield `var ${componentCtxVar}!: __VLS_PickFunctionalComponentCtx<typeof ${componentOriginalVar}, typeof ${componentVNodeVar}>${endOfLine}`;
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

	yield `__VLS_asFunctionalElement(__VLS_intrinsicElements`;
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
		...generateElementProps(
			options,
			ctx,
			node,
			node.props,
			options.vueCompilerOptions.checkUnknownProps,
			true,
			failedPropExps
		),
		`}`
	);
	yield `)${endOfLine}`;

	yield* generateFailedPropExps(options, ctx, failedPropExps);
	yield* generateElementDirectives(options, ctx, node);

	const [refName, offset] = yield* generateElementReference(options, ctx, node);
	if (refName && offset) {
		let typeExp = `__VLS_NativeElements['${node.tag}']`;
		if (isVForChild) {
			typeExp += `[]`;
		}
		ctx.templateRefs.set(refName, {
			typeExp,
			offset
		});
	}
	if (ctx.singleRootNodes.has(node)) {
		ctx.singleRootElTypes.push(`__VLS_NativeElements['${node.tag}']`);
	}

	if (hasVBindAttrs(options, ctx, node)) {
		ctx.inheritedAttrVars.add(`__VLS_intrinsicElements.${node.tag}`);
	}

	collectStyleScopedClassReferences(options, ctx, node);

	yield* generateElementChildren(options, ctx, node);
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

function* generateElementReference(
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

			// navigation support for `const foo = ref()`
			yield `/** @type {typeof __VLS_ctx`;
			yield* generatePropertyAccess(
				options,
				ctx,
				content,
				startOffset,
				ctx.codeFeatures.navigation,
				prop.value.loc
			);
			yield `} */${endOfLine}`;

			if (variableNameRegex.test(content) && !options.templateRefNames.has(content)) {
				ctx.accessExternalVariable(content, startOffset);
			}

			return [content, startOffset];
		}
	}
	return [];
}

function hasVBindAttrs(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode
) {
	return options.vueCompilerOptions.fallthroughAttributes && (
		(options.inheritAttrs && ctx.singleRootNodes.has(node)) ||
		node.props.some(prop =>
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& prop.exp?.loc.source === '$attrs'
		)
	);
}

function camelizeComponentName(newName: string) {
	return camelize('-' + newName);
}

function getTagRenameApply(oldName: string) {
	return oldName === hyphenateTag(oldName) ? hyphenateTag : undefined;
}

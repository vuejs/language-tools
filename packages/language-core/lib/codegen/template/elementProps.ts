import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import { isMatch } from 'picomatch';
import type { Code, VueCodeInformation, VueCompilerOptions } from '../../types';
import { getAttributeValueOffset, hyphenateAttr, hyphenateTag } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import { identifierRegex, newLine } from '../utils';
import { generateCamelized } from '../utils/camelized';
import { generateUnicode } from '../utils/unicode';
import { wrapWith } from '../utils/wrapWith';
import type { TemplateCodegenContext } from './context';
import { generateModifiers } from './elementDirectives';
import { generateEventArg, generateEventExpression } from './elementEvents';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';

export interface FailedPropExpression {
	node: CompilerDOM.SimpleExpressionNode;
	prefix: string;
	suffix: string;
}

export function* generateElementProps(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	props: CompilerDOM.ElementNode['props'],
	strictPropsCheck: boolean,
	failedPropExps?: FailedPropExpression[],
): Generator<Code> {
	const isComponent = node.tagType === CompilerDOM.ElementTypes.COMPONENT;

	for (const prop of props) {
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'on'
		) {
			if (
				prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& !prop.arg.loc.source.startsWith('[')
				&& !prop.arg.loc.source.endsWith(']')
			) {
				if (!isComponent) {
					yield `...{ `;
					yield* generateEventArg(options, prop.arg.loc.source, prop.arg.loc.start.offset);
					yield `: `;
					yield* generateEventExpression(options, ctx, prop);
					yield `},`;
				}
				else {
					yield `...{ '${camelize('on-' + prop.arg.loc.source)}': {} as any },`;
				}
				yield newLine;
			}
			else if (
				prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.loc.source.startsWith('[')
				&& prop.arg.loc.source.endsWith(']')
			) {
				failedPropExps?.push({ node: prop.arg, prefix: `(`, suffix: `)` });
				failedPropExps?.push({ node: prop.exp, prefix: `() => {`, suffix: `}` });
			}
			else if (
				!prop.arg
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				failedPropExps?.push({ node: prop.exp, prefix: `(`, suffix: `)` });
			}
		}
	}

	for (const prop of props) {
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& (
				(prop.name === 'bind' && prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
				|| prop.name === 'model'
			)
			&& (!prop.exp || prop.exp.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
		) {
			let propName: string | undefined;

			if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
				propName = prop.arg.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY
					? prop.arg.content
					: prop.arg.loc.source;
			}
			else {
				propName = getModelPropName(node, options.vueCompilerOptions);
			}

			if (
				propName === undefined
				|| options.vueCompilerOptions.dataAttributes.some(pattern => isMatch(propName!, pattern))
			) {
				if (prop.exp && prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
					failedPropExps?.push({ node: prop.exp, prefix: `(`, suffix: `)` });
				}
				continue;
			}

			if (
				prop.name === 'bind'
				&& prop.modifiers.some(m => m.content === 'prop' || m.content === 'attr')
			) {
				propName = propName.slice(1);
			}

			const shouldSpread = propName === 'style' || propName === 'class';
			const shouldCamelize = isComponent && getShouldCamelize(options, prop, propName);
			const features = getPropsCodeFeatures(strictPropsCheck);

			if (shouldSpread) {
				yield `...{ `;
			}
			yield* wrapWith(
				'template',
				prop.loc.start.offset,
				prop.loc.end.offset,
				codeFeatures.verification,
				...(
					prop.arg
						? generateObjectProperty(
							options,
							ctx,
							propName,
							prop.arg.loc.start.offset,
							features,
							shouldCamelize,
						)
						: wrapWith(
							'template',
							prop.loc.start.offset,
							prop.loc.start.offset + 'v-model'.length,
							codeFeatures.withoutHighlightAndCompletion,
							propName,
						)
				),
				`: `,
				...wrapWith(
					'template',
					prop.arg?.loc.start.offset ?? prop.loc.start.offset,
					prop.arg?.loc.end.offset ?? prop.loc.end.offset,
					codeFeatures.verification,
					...generatePropExp(
						options,
						ctx,
						prop,
						prop.exp,
					),
				),
			);
			if (shouldSpread) {
				yield ` }`;
			}
			yield `,${newLine}`;

			if (isComponent && prop.name === 'model' && prop.modifiers.length) {
				const propertyName = prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					? !prop.arg.isStatic
						? `[__VLS_tryAsConstant(\`\${${prop.arg.content}}Modifiers\`)]`
						: camelize(propName) + `Modifiers`
					: `modelModifiers`;
				yield* generateModifiers(options, ctx, prop, propertyName);
				yield newLine;
			}
		}
		else if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
			if (options.vueCompilerOptions.dataAttributes.some(pattern => isMatch(prop.name, pattern))) {
				continue;
			}

			const shouldSpread = prop.name === 'style' || prop.name === 'class';
			const shouldCamelize = isComponent && getShouldCamelize(options, prop, prop.name);
			const features = getPropsCodeFeatures(strictPropsCheck);

			if (shouldSpread) {
				yield `...{ `;
			}
			yield* wrapWith(
				'template',
				prop.loc.start.offset,
				prop.loc.end.offset,
				codeFeatures.verification,
				...generateObjectProperty(
					options,
					ctx,
					prop.name,
					prop.loc.start.offset,
					features,
					shouldCamelize,
				),
				`: `,
				...(
					prop.value
						? generateAttrValue(prop.value, codeFeatures.withoutNavigation)
						: [`true`]
				),
			);
			if (shouldSpread) {
				yield ` }`;
			}
			yield `,${newLine}`;
		}
		else if (
			prop.name === 'bind'
			&& !prop.arg
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			if (prop.exp.loc.source === '$attrs') {
				ctx.bindingAttrLocs.push(prop.exp.loc);
			}
			else {
				yield* wrapWith(
					'template',
					prop.exp.loc.start.offset,
					prop.exp.loc.end.offset,
					codeFeatures.verification,
					`...`,
					...generatePropExp(
						options,
						ctx,
						prop,
						prop.exp,
					),
				);
				yield `,${newLine}`;
			}
		}
	}
}

export function* generatePropExp(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	exp: CompilerDOM.SimpleExpressionNode | undefined,
): Generator<Code> {
	if (!exp) {
		yield `{}`;
	}
	else if (prop.arg?.loc.start.offset !== prop.exp?.loc.start.offset) {
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			codeFeatures.all,
			exp.loc.source,
			exp.loc.start.offset,
			`(`,
			`)`,
		);
	}
	else {
		const propVariableName = camelize(exp.loc.source);

		if (identifierRegex.test(propVariableName)) {
			const codes = generateCamelized(
				exp.loc.source,
				'template',
				exp.loc.start.offset,
				codeFeatures.withoutHighlightAndCompletion,
			);

			if (options.destructuredPropNames.has(propVariableName) || ctx.hasLocalVariable(propVariableName)) {
				yield* codes;
			}
			else if (options.templateRefNames.has(propVariableName)) {
				yield `__VLS_unref(`;
				yield* codes;
				yield `)`;
			}
			else {
				ctx.accessExternalVariable(propVariableName, exp.loc.start.offset);
				yield `__VLS_ctx.`;
				yield* codes;
			}

			ctx.inlayHints.push(createVBindShorthandInlayHintInfo(prop.loc, propVariableName));
		}
	}
}

function* generateAttrValue(
	node: CompilerDOM.TextNode,
	features: VueCodeInformation,
): Generator<Code> {
	const quote = node.loc.source.startsWith("'") ? "'" : '"';
	const offset = getAttributeValueOffset(node);
	yield quote;
	yield* generateUnicode(node.content, offset, features);
	yield quote;
}

function getShouldCamelize(
	options: TemplateCodegenOptions,
	prop: CompilerDOM.AttributeNode | CompilerDOM.DirectiveNode,
	propName: string,
) {
	return (
		prop.type !== CompilerDOM.NodeTypes.DIRECTIVE
		|| !prop.arg
		|| (prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)
	)
		&& hyphenateAttr(propName) === propName
		&& !options.vueCompilerOptions.htmlAttributes.some(pattern => isMatch(propName, pattern));
}

function getPropsCodeFeatures(strictPropsCheck: boolean): VueCodeInformation {
	return {
		...codeFeatures.withoutHighlightAndCompletion,
		...strictPropsCheck
			? codeFeatures.verification
			: codeFeatures.doNotReportTs2353AndTs2561,
	};
}

function getModelPropName(node: CompilerDOM.ElementNode, vueCompilerOptions: VueCompilerOptions) {
	for (const modelName in vueCompilerOptions.experimentalModelPropName) {
		const tags = vueCompilerOptions.experimentalModelPropName[modelName];
		for (const tag in tags) {
			if (node.tag === tag || node.tag === hyphenateTag(tag)) {
				const val = tags[tag];
				if (typeof val === 'object') {
					const arr = Array.isArray(val) ? val : [val];
					for (const attrs of arr) {
						let failed = false;
						for (const attr in attrs) {
							const attrNode = node.props.find(
								prop => prop.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop.name === attr,
							) as CompilerDOM.AttributeNode | undefined;
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

	return 'modelValue';
}

import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import { toString } from 'muggle-string';
import { isMatch } from 'picomatch';
import type { Code, VueCodeInformation, VueCompilerOptions } from '../../types';
import { hyphenateAttr, hyphenateTag } from '../../utils/shared';
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
	enableCodeFeatures: boolean,
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
			const codes = [...wrapWith(
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
							prop.loc.start.offset,
							prop.loc.start.offset + 'v-model'.length,
							codeFeatures.withoutHighlightAndCompletion,
							propName,
						)
				),
				`: `,
				...wrapWith(
					prop.arg?.loc.start.offset ?? prop.loc.start.offset,
					prop.arg?.loc.end.offset ?? prop.loc.end.offset,
					codeFeatures.verification,
					...generatePropExp(
						options,
						ctx,
						prop,
						prop.exp,
						enableCodeFeatures,
					),
				),
			)];
			if (enableCodeFeatures) {
				yield* codes;
			}
			else {
				yield toString(codes);
			}
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
				const codes = [...generateModifiers(
					options,
					ctx,
					prop,
					propertyName,
				)];
				if (enableCodeFeatures) {
					yield* codes;
				}
				else {
					yield toString(codes);
				}
				yield newLine;
			}
		}
		else if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
			if (
				options.vueCompilerOptions.dataAttributes.some(pattern => isMatch(prop.name, pattern))
				// Vue 2 Transition doesn't support "persisted" property but `@vue/compiler-dom` always adds it (#3881)
				|| (
					options.vueCompilerOptions.target < 3
					&& prop.name === 'persisted'
					&& node.tag.toLowerCase() === 'transition'
				)
			) {
				continue;
			}

			const shouldSpread = prop.name === 'style' || prop.name === 'class';
			const shouldCamelize = isComponent && getShouldCamelize(options, prop, prop.name);
			const features = getPropsCodeFeatures(strictPropsCheck);

			if (shouldSpread) {
				yield `...{ `;
			}
			const codes = [...wrapWith(
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
			)];
			if (enableCodeFeatures) {
				yield* codes;
			}
			else {
				yield toString(codes);
			}
			if (shouldSpread) {
				yield ` }`;
			}
			yield `,${newLine}`;
		}
		else if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& !prop.arg
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			if (prop.exp.loc.source === '$attrs') {
				if (enableCodeFeatures) {
					ctx.bindingAttrLocs.push(prop.exp.loc);
				}
			}
			else {
				const codes = [...wrapWith(
					prop.exp.loc.start.offset,
					prop.exp.loc.end.offset,
					codeFeatures.verification,
					`...`,
					...generatePropExp(
						options,
						ctx,
						prop,
						prop.exp,
						enableCodeFeatures,
					),
				)];
				if (enableCodeFeatures) {
					yield* codes;
				}
				else {
					yield toString(codes);
				}
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
	enableCodeFeatures: boolean = true,
): Generator<Code> {
	const isShorthand = prop.arg?.loc.start.offset === prop.exp?.loc.start.offset;
	const features = isShorthand
		? codeFeatures.withoutHighlightAndCompletion
		: codeFeatures.all;

	if (exp && exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) { // style='z-index: 2' will compile to {'z-index':'2'}
		if (!isShorthand) { // vue 3.4+
			yield* generateInterpolation(
				options,
				ctx,
				'template',
				features,
				exp.loc.source,
				exp.loc.start.offset,
				`(`,
				`)`,
			);
		}
		else {
			const propVariableName = camelize(exp.loc.source);

			if (identifierRegex.test(propVariableName)) {
				const isDestructuredProp = options.destructuredPropNames?.has(propVariableName) ?? false;
				const isTemplateRef = options.templateRefNames?.has(propVariableName) ?? false;

				const codes = generateCamelized(
					exp.loc.source,
					'template',
					exp.loc.start.offset,
					features,
				);

				if (ctx.hasLocalVariable(propVariableName) || isDestructuredProp) {
					yield* codes;
				}
				else {
					ctx.accessExternalVariable(propVariableName, exp.loc.start.offset);

					if (isTemplateRef) {
						yield `__VLS_unref(`;
						yield* codes;
						yield `)`;
					}
					else {
						yield `__VLS_ctx.`;
						yield* codes;
					}
				}

				if (enableCodeFeatures) {
					ctx.inlayHints.push(createVBindShorthandInlayHintInfo(prop.loc, propVariableName));
				}
			}
		}
	}
	else {
		yield `{}`;
	}
}

function* generateAttrValue(
	attrNode: CompilerDOM.TextNode,
	features: VueCodeInformation,
): Generator<Code> {
	const quote = attrNode.loc.source.startsWith("'") ? "'" : '"';
	yield quote;
	let start = attrNode.loc.start.offset;
	let content = attrNode.loc.source;
	if (
		(content.startsWith('"') && content.endsWith('"'))
		|| (content.startsWith("'") && content.endsWith("'"))
	) {
		start++;
		content = content.slice(1, -1);
	}
	yield* generateUnicode(content, start, features);
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
		|| (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)
	)
		&& hyphenateAttr(propName) === propName
		&& !options.vueCompilerOptions.htmlAttributes.some(pattern => isMatch(propName, pattern));
}

function getPropsCodeFeatures(
	strictPropsCheck: boolean,
): VueCodeInformation {
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

	return vueCompilerOptions.target < 3 ? 'value' : 'modelValue';
}

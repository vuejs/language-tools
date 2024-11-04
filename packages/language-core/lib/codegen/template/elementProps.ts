import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import { minimatch } from 'minimatch';
import { toString } from 'muggle-string';
import type { Code, VueCodeInformation, VueCompilerOptions } from '../../types';
import { hyphenateAttr, hyphenateTag } from '../../utils/shared';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import { conditionWrapWith, variableNameRegex, wrapWith } from '../utils';
import { generateCamelized } from '../utils/camelized';
import { generateUnicode } from '../utils/unicode';
import type { TemplateCodegenContext } from './context';
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
	failedPropExps?: FailedPropExpression[]
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
					yield* generateEventArg(ctx, prop.arg, true);
					yield `: `;
					yield* generateEventExpression(options, ctx, prop);
					yield `}, `;
				}
				else {
					yield `...{ '${camelize('on-' + prop.arg.loc.source)}': {} as any }, `;
				}
			}
			else if (
				prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
				&& prop.arg.loc.source.startsWith('[')
				&& prop.arg.loc.source.endsWith(']')
			) {
				failedPropExps?.push({ node: prop.arg, prefix: '(', suffix: ')' });
				failedPropExps?.push({ node: prop.exp, prefix: '() => {', suffix: '}' });
			}
			else if (
				!prop.arg
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				failedPropExps?.push({ node: prop.exp, prefix: '(', suffix: ')' });
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
				propName = getModelValuePropName(node, options.vueCompilerOptions.target, options.vueCompilerOptions);
			}

			if (
				propName === undefined
				|| options.vueCompilerOptions.dataAttributes.some(pattern => minimatch(propName!, pattern))
			) {
				if (prop.exp && prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
					failedPropExps?.push({ node: prop.exp, prefix: '(', suffix: ')' });
				}
				continue;
			}

			if (prop.modifiers.some(m => m.content === 'prop' || m.content === 'attr')) {
				propName = propName.slice(1);
			}

			const shouldSpread = propName === 'style' || propName === 'class';
			const shouldCamelize = isComponent
				&& (!prop.arg || (prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)) // isStatic
				&& hyphenateAttr(propName) === propName
				&& !options.vueCompilerOptions.htmlAttributes.some(pattern => minimatch(propName, pattern));

			if (shouldSpread) {
				yield `...{ `;
			}
			const codeInfo = getPropsCodeInfo(ctx, strictPropsCheck, shouldCamelize);
			const codes = wrapWith(
				prop.loc.start.offset,
				prop.loc.end.offset,
				ctx.codeFeatures.verification,
				...(
					prop.arg
						? generateObjectProperty(
							options,
							ctx,
							propName,
							prop.arg.loc.start.offset,
							codeInfo,
							(prop.loc as any).name_2 ??= {},
							shouldCamelize
						)
						: wrapWith(
							prop.loc.start.offset,
							prop.loc.start.offset + 'v-model'.length,
							ctx.codeFeatures.verification,
							propName
						)
				),
				`: (`,
				...generatePropExp(
					options,
					ctx,
					prop,
					prop.exp,
					ctx.codeFeatures.all,
					prop.arg?.loc.start.offset === prop.exp?.loc.start.offset,
					enableCodeFeatures
				),
				`)`
			);
			if (!enableCodeFeatures) {
				yield toString([...codes]);
			}
			else {
				yield* codes;
			}
			if (shouldSpread) {
				yield ` }`;
			}
			yield `, `;
		}
		else if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
			if (
				options.vueCompilerOptions.dataAttributes.some(pattern => minimatch(prop.name, pattern))
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
			const shouldCamelize = isComponent
				&& hyphenateAttr(prop.name) === prop.name
				&& !options.vueCompilerOptions.htmlAttributes.some(pattern => minimatch(prop.name, pattern));

			if (shouldSpread) {
				yield `...{ `;
			}
			const codeInfo = getPropsCodeInfo(ctx, strictPropsCheck, true);
			const codes = conditionWrapWith(
				enableCodeFeatures,
				prop.loc.start.offset,
				prop.loc.end.offset,
				ctx.codeFeatures.verification,
				...generateObjectProperty(
					options,
					ctx,
					prop.name,
					prop.loc.start.offset,
					codeInfo,
					(prop.loc as any).name_1 ??= {},
					shouldCamelize
				),
				`: (`,
				...(
					prop.value
						? generateAttrValue(prop.value, ctx.codeFeatures.all)
						: [`true`]
				),
				`)`
			);
			if (!enableCodeFeatures) {
				yield toString([...codes]);
			}
			else {
				yield* codes;
			}
			if (shouldSpread) {
				yield ` }`;
			}
			yield `, `;
		}
		else if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& !prop.arg
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			const codes = conditionWrapWith(
				enableCodeFeatures,
				prop.exp.loc.start.offset,
				prop.exp.loc.end.offset,
				ctx.codeFeatures.verification,
				`...`,
				...generateInterpolation(
					options,
					ctx,
					'template',
					ctx.codeFeatures.all,
					prop.exp.content,
					prop.exp.loc.start.offset,
					prop.exp.loc,
					'(',
					')'
				)
			);
			if (!enableCodeFeatures) {
				yield toString([...codes]);
			}
			else {
				yield* codes;
			}
			yield `, `;
		}
	}
}

function getPropsCodeInfo(
	ctx: TemplateCodegenContext,
	strictPropsCheck: boolean,
	shouldCamelize: boolean
): VueCodeInformation {
	const codeInfo = ctx.codeFeatures.withoutHighlightAndCompletion;
	return {
		...codeInfo,
		navigation: codeInfo.navigation
			? {
				resolveRenameNewName: camelize,
				resolveRenameEditText: shouldCamelize ? hyphenateAttr : undefined,
			}
			: false,
		verification: strictPropsCheck
			? codeInfo.verification
			: {
				shouldReport(_source, code) {
					if (String(code) === '2353' || String(code) === '2561') {
						return false;
					}
					return typeof codeInfo.verification === 'object'
						? codeInfo.verification.shouldReport?.(_source, code) ?? true
						: true;
				},
			}
	};
}

function* generatePropExp(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	exp: CompilerDOM.SimpleExpressionNode | undefined,
	features: VueCodeInformation,
	isShorthand: boolean,
	enableCodeFeatures: boolean
): Generator<Code> {
	if (isShorthand && features.completion) {
		features = {
			...features,
			completion: undefined,
		};
	}
	if (exp && exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) { // style='z-index: 2' will compile to {'z-index':'2'}
		if (!isShorthand) { // vue 3.4+
			yield* generateInterpolation(
				options,
				ctx,
				'template',
				features,
				exp.loc.source,
				exp.loc.start.offset,
				exp.loc,
				'(',
				')'
			);
		} else {
			const propVariableName = camelize(exp.loc.source);

			if (variableNameRegex.test(propVariableName)) {
				if (!ctx.hasLocalVariable(propVariableName)) {
					ctx.accessExternalVariable(propVariableName, exp.loc.start.offset);
					yield `__VLS_ctx.`;
				}
				yield* generateCamelized(
					exp.loc.source,
					exp.loc.start.offset,
					features
				);
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

function* generateAttrValue(attrNode: CompilerDOM.TextNode, features: VueCodeInformation): Generator<Code> {
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

function getModelValuePropName(node: CompilerDOM.ElementNode, vueVersion: number, vueCompilerOptions: VueCompilerOptions) {

	for (const modelName in vueCompilerOptions.experimentalModelPropName) {
		const tags = vueCompilerOptions.experimentalModelPropName[modelName];
		for (const tag in tags) {
			if (node.tag === tag || node.tag === hyphenateTag(tag)) {
				const v = tags[tag];
				if (typeof v === 'object') {
					const arr = Array.isArray(v) ? v : [v];
					for (const attrs of arr) {
						let failed = false;
						for (const attr in attrs) {
							const attrNode = node.props.find(prop => prop.type === CompilerDOM.NodeTypes.ATTRIBUTE && prop.name === attr) as CompilerDOM.AttributeNode | undefined;
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

	return vueVersion < 3 ? 'value' : 'modelValue';
}

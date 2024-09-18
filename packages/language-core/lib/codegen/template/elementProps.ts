import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import { minimatch } from 'minimatch';
import { toString } from 'muggle-string';
import type { Code, VueCodeInformation, VueCompilerOptions } from '../../types';
import { hyphenateAttr, hyphenateTag } from '../../utils/shared';
import { conditionWrapWith, variableNameRegex, wrapWith } from '../common';
import { generateCamelized } from './camelized';
import type { TemplateCodegenContext } from './context';
import { generateEventArg, generateEventExpression } from './elementEvents';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';

export function* generateElementProps(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	props: CompilerDOM.ElementNode['props'],
	enableCodeFeatures: boolean,
	propsFailedExps?: {
		node: CompilerDOM.SimpleExpressionNode;
		prefix: string;
		suffix: string;
	}[]
): Generator<Code> {
	const isIntrinsicElement = node.tagType === CompilerDOM.ElementTypes.ELEMENT || node.tagType === CompilerDOM.ElementTypes.TEMPLATE;
	const canCamelize = node.tagType === CompilerDOM.ElementTypes.COMPONENT;

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
				if (isIntrinsicElement) {
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
				propsFailedExps?.push({ node: prop.arg, prefix: '(', suffix: ')' });
				propsFailedExps?.push({ node: prop.exp, prefix: '() => {', suffix: '}' });
			}
			else if (
				!prop.arg
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				propsFailedExps?.push({ node: prop.exp, prefix: '(', suffix: ')' });
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
					propsFailedExps?.push({ node: prop.exp, prefix: '(', suffix: ')' });
				}
				continue;
			}

			if (prop.modifiers.some(m => m.content === 'prop' || m.content === 'attr')) {
				propName = propName.substring(1);
			}

			const shouldSpread = propName === 'style' || propName === 'class';
			const shouldCamelize = canCamelize
				&& (!prop.arg || (prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)) // isStatic
				&& hyphenateAttr(propName) === propName
				&& !options.vueCompilerOptions.htmlAttributes.some(pattern => minimatch(propName, pattern));

			if (shouldSpread) {
				yield `...{ `;
			}
			const codeInfo = ctx.codeFeatures.withoutHighlightAndCompletion;
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
							{
								...codeInfo,
								verification: options.vueCompilerOptions.strictTemplates
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
									},
								navigation: codeInfo.navigation
									? {
										resolveRenameNewName: camelize,
										resolveRenameEditText: shouldCamelize ? hyphenateAttr : undefined,
									}
									: false,
							},
							(prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {}),
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
				// Vue 2 Transition doesn't support "persisted" property but `@vue/compiler-dom always adds it (#3881)
				|| (
					options.vueCompilerOptions.target < 3
					&& prop.name === 'persisted'
					&& node.tag.toLowerCase() === 'transition'
				)
			) {
				continue;
			}

			const shouldSpread = prop.name === 'style' || prop.name === 'class';
			const shouldCamelize = canCamelize
				&& hyphenateAttr(prop.name) === prop.name
				&& !options.vueCompilerOptions.htmlAttributes.some(pattern => minimatch(prop.name, pattern));

			if (shouldSpread) {
				yield `...{ `;
			}
			const codeInfo = shouldCamelize
				? {
					...ctx.codeFeatures.withoutHighlightAndCompletion,
					navigation: ctx.codeFeatures.withoutHighlightAndCompletion.navigation
						? {
							resolveRenameNewName: camelize,
							resolveRenameEditText: hyphenateAttr,
						}
						: false,
				}
				: {
					...ctx.codeFeatures.withoutHighlightAndCompletion,
				};
			if (!options.vueCompilerOptions.strictTemplates) {
				const verification = codeInfo.verification;
				codeInfo.verification = {
					shouldReport(_source, code) {
						if (String(code) === '2353' || String(code) === '2561') {
							return false;
						}
						return typeof verification === 'object'
							? verification.shouldReport?.(_source, code) ?? true
							: true;
					},
				};
			}
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
					(prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}),
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
					prop.exp.content,
					prop.exp.loc,
					prop.exp.loc.start.offset,
					ctx.codeFeatures.all,
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
		else {
			// comment this line to avoid affecting comments in prop expressions
			// tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */ ");
		}
	}
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
				exp.loc.source,
				exp.loc,
				exp.loc.start.offset,
				features,
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
					ctx.inlayHints.push({
						blockName: 'template',
						offset: prop.loc.end.offset,
						setting: 'vue.inlayHints.vBindShorthand',
						label: `="${propVariableName}"`,
						tooltip: [
							`This is a shorthand for \`${prop.loc.source}="${propVariableName}"\`.`,
							'To hide this hint, set `vue.inlayHints.vBindShorthand` to `false` in IDE settings.',
							'[More info](https://github.com/vuejs/core/pull/9451)',
						].join('\n\n'),
					});
				}
			}
		}
	}
	else {
		yield `{}`;
	}
}

function* generateAttrValue(attrNode: CompilerDOM.TextNode, features: VueCodeInformation): Generator<Code> {
	const char = attrNode.loc.source.startsWith("'") ? "'" : '"';
	yield char;
	let start = attrNode.loc.start.offset;
	let end = attrNode.loc.end.offset;
	let content = attrNode.loc.source;
	if (
		(content.startsWith('"') && content.endsWith('"'))
		|| (content.startsWith("'") && content.endsWith("'"))
	) {
		start++;
		end--;
		content = content.slice(1, -1);
	}
	if (needToUnicode(content)) {
		yield* wrapWith(
			start,
			end,
			features,
			toUnicode(content)
		);
	}
	else {
		yield [content, 'template', start, features];
	}
	yield char;
}

function needToUnicode(str: string) {
	return str.includes('\\') || str.includes('\n');
}

function toUnicode(str: string) {
	return str.split('').map(value => {
		const temp = value.charCodeAt(0).toString(16).padStart(4, '0');
		if (temp.length > 2) {
			return '\\u' + temp;
		}
		return value;
	}).join('');
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

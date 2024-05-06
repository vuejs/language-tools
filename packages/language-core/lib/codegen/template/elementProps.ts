import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import { minimatch } from 'minimatch';
import type { Code, VueCodeInformation, VueCompilerOptions } from '../../types';
import { hyphenateAttr, hyphenateTag } from '../../utils/shared';
import { conditionWrapWith, newLine, variableNameRegex, wrapWith } from '../common';
import { generateCamelized } from './camelized';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';
import { toString } from '@volar/language-core';
import { generateEventArg, generateEventExpression } from './elementEvents';

export function* generateElementProps(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	props: CompilerDOM.ElementNode['props'],
	enableCodeFeatures: boolean,
	propsFailedExps?: CompilerDOM.SimpleExpressionNode[],
): Generator<Code> {
	let styleAttrNum = 0;
	let classAttrNum = 0;

	const isIntrinsicElement = node.tagType === CompilerDOM.ElementTypes.ELEMENT || node.tagType === CompilerDOM.ElementTypes.TEMPLATE;
	const canCamelize = node.tagType === CompilerDOM.ElementTypes.COMPONENT;

	if (props.some(prop =>
		prop.type === CompilerDOM.NodeTypes.DIRECTIVE
		&& prop.name === 'bind'
		&& !prop.arg
		&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
	)) {
		// fix https://github.com/vuejs/language-tools/issues/2166
		styleAttrNum++;
		classAttrNum++;
	}

	if (isIntrinsicElement) {
		for (const prop of props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
			) {
				if (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					yield* generateEventArg(options, ctx, prop.arg, false, true);
					yield `: `;
					yield* generateEventExpression(options, ctx, prop);
					yield `,${newLine}`;
				}
				else if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
					propsFailedExps?.push(prop.exp);
				}
			}
		}
	}
	else {
		let generatedEvent = false;
		for (const prop of props) {
			if (
				prop.type === CompilerDOM.NodeTypes.DIRECTIVE
				&& prop.name === 'on'
				&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				if (prop.arg.loc.source.startsWith('[') && prop.arg.loc.source.endsWith(']')) {
					continue;
				}
				if (!generatedEvent) {
					yield `...{ `;
					generatedEvent = true;
				}
				yield `'${camelize('on-' + prop.arg.loc.source)}': {} as any, `;
			}
		}
		if (generatedEvent) {
			yield `}, `;
		}
	}

	for (const prop of props) {
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& (prop.name === 'bind' || prop.name === 'model')
			&& (prop.name === 'model' || prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
			&& (!prop.exp || prop.exp.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION)
		) {
			let propName =
				prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					? prop.arg.constType === CompilerDOM.ConstantTypes.CAN_STRINGIFY
						? prop.arg.content
						: prop.arg.loc.source
					: getModelValuePropName(node, options.vueCompilerOptions.target, options.vueCompilerOptions);

			if (prop.modifiers.some(m => m === 'prop' || m === 'attr')) {
				propName = propName?.substring(1);
			}

			if (
				propName === undefined
				|| options.vueCompilerOptions.dataAttributes.some(pattern => minimatch(propName, pattern))
				|| (propName === 'style' && ++styleAttrNum >= 2)
				|| (propName === 'class' && ++classAttrNum >= 2)
				|| (propName === 'name' && node.tagType === CompilerDOM.ElementTypes.SLOT) // #2308
			) {
				if (prop.exp && prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) {
					propsFailedExps?.push(prop.exp);
				}
				continue;
			}

			const shouldCamelize = canCamelize
				&& (!prop.arg || (prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)) // isStatic
				&& hyphenateAttr(propName) === propName
				&& !options.vueCompilerOptions.htmlAttributes.some(pattern => minimatch(propName, pattern));

			const codes = wrapWith(
				prop.loc.start.offset,
				prop.loc.end.offset,
				ctx.codeFeatures.verification,
				...generateObjectProperty(
					options,
					ctx,
					propName,
					prop.arg
						? prop.arg.loc.start.offset
						: prop.loc.start.offset,
					prop.arg
						? {
							...ctx.codeFeatures.withoutHighlightAndCompletion,
							navigation: ctx.codeFeatures.withoutHighlightAndCompletion.navigation
								? {
									resolveRenameNewName: camelize,
									resolveRenameEditText: shouldCamelize ? hyphenateAttr : undefined,
								}
								: false,
						}
						: ctx.codeFeatures.withoutHighlightAndCompletion,
					(prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {}),
					shouldCamelize,
				),
				`: (`,
				...genereatePropExp(
					options,
					ctx,
					prop.exp,
					ctx.codeFeatures.all,
					prop.arg?.loc.start.offset === prop.exp?.loc.start.offset,
					enableCodeFeatures,
				),
				`)`,
			);
			if (!enableCodeFeatures) {
				yield toString([...codes]);
			}
			else {
				yield* codes;
			}
			yield `, `;
		}
		else if (prop.type === CompilerDOM.NodeTypes.ATTRIBUTE) {
			if (
				options.vueCompilerOptions.dataAttributes.some(pattern => minimatch(prop.name, pattern))
				|| (prop.name === 'style' && ++styleAttrNum >= 2)
				|| (prop.name === 'class' && ++classAttrNum >= 2)
				|| (prop.name === 'name' && node.tagType === CompilerDOM.ElementTypes.SLOT) // #2308
			) {
				continue;
			}

			if (
				options.vueCompilerOptions.target < 3
				&& prop.name === 'persisted'
				&& node.tag.toLowerCase() === 'transition'
			) {
				// Vue 2 Transition doesn't support "persisted" property but `@vue/compiler-dom always adds it (#3881)
				continue;
			}

			const shouldCamelize = canCamelize
				&& hyphenateAttr(prop.name) === prop.name
				&& !options.vueCompilerOptions.htmlAttributes.some(pattern => minimatch(prop.name, pattern));

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
					shouldCamelize
						? {
							...ctx.codeFeatures.withoutHighlightAndCompletion,
							navigation: ctx.codeFeatures.withoutHighlightAndCompletion.navigation
								? {
									resolveRenameNewName: camelize,
									resolveRenameEditText: hyphenateAttr,
								}
								: false,
						}
						: ctx.codeFeatures.withoutHighlightAndCompletion,
					(prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}),
					shouldCamelize,
				),
				`: (`,
				...(
					prop.value
						? generateAttrValue(prop.value, ctx.codeFeatures.all)
						: [`true`]
				),
				`)`,
			);
			if (!enableCodeFeatures) {
				yield toString([...codes]);
			}
			else {
				yield* codes;
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
					')',
				),
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

function* genereatePropExp(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	exp: CompilerDOM.SimpleExpressionNode | undefined,
	features: VueCodeInformation,
	isShorthand: boolean,
	inlayHints: boolean,
): Generator<Code> {
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
				')',
			);
		} else {
			const propVariableName = camelize(exp.loc.source);

			if (variableNameRegex.test(propVariableName)) {
				if (!ctx.hasLocalVariable(propVariableName)) {
					ctx.accessGlobalVariable(propVariableName, exp.loc.start.offset);
					yield `__VLS_ctx.`;
				}
				yield* generateCamelized(
					exp.loc.source,
					exp.loc.start.offset,
					features,
				);
				if (inlayHints) {
					yield [
						'',
						'template',
						exp.loc.end.offset,
						{
							__hint: {
								setting: 'vue.inlayHints.vBindShorthand',
								label: `="${propVariableName}"`,
								tooltip: [
									`This is a shorthand for \`${exp.loc.source}="${propVariableName}"\`.`,
									'To hide this hint, set `vue.inlayHints.vBindShorthand` to `false` in IDE settings.',
									'[More info](https://github.com/vuejs/core/pull/9451)',
								].join('\n\n'),
							},
						} as VueCodeInformation,
					];
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
			toUnicode(content),
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

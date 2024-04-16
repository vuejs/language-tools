import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import { minimatch } from 'minimatch';
import type { Code, VueCodeInformation, VueCompilerOptions } from '../../types';
import { hyphenateAttr, hyphenateTag } from '../../utils/shared';
import { variableNameRegex, wrapWith } from '../common';
import { generateCamelized } from './camelized';
import type { TemplateCodegenContext, TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';

export function* generateElementProps(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	props: CompilerDOM.ElementNode['props'],
	mode: 'normal' | 'navigationOnly',
	propsFailedExps?: CompilerDOM.SimpleExpressionNode[],
): Generator<Code> {

	let styleAttrNum = 0;
	let classAttrNum = 0;
	let defaultCodeFeatures: VueCodeInformation = ctx.codeFeatures.all;
	let attrCodeFeatures: VueCodeInformation = ctx.codeFeatures.withoutHighlightAndCompletion;

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

	if (mode === 'navigationOnly') {
		defaultCodeFeatures = ctx.codeFeatures.navigation;
		attrCodeFeatures = ctx.codeFeatures.navigation;
	}

	yield `...{ `;
	for (const prop of props) {
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'on'
			&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			yield `'${camelize('on-' + prop.arg.loc.source)}': {} as any, `;
		}
	}
	yield `}, `;

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
				|| options.vueCompilerOptions.dataAttributes.some(pattern => minimatch(propName!, pattern))
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
				&& !options.vueCompilerOptions.htmlAttributes.some(pattern => minimatch(propName!, pattern));

			if (mode === 'normal') {
				yield [
					'',
					'template',
					prop.loc.start.offset,
					ctx.codeFeatures.verification,
				];
			}
			yield* generateObjectProperty(
				options,
				ctx,
				propName,
				prop.arg
					? prop.arg.loc.start.offset
					: prop.loc.start.offset,
				prop.arg
					? {
						...attrCodeFeatures,
						navigation: attrCodeFeatures.navigation
							? {
								resolveRenameNewName: camelize,
								resolveRenameEditText: shouldCamelize ? hyphenateAttr : undefined,
							}
							: false,
					}
					: attrCodeFeatures,
				(prop.loc as any).name_2 ?? ((prop.loc as any).name_2 = {}),
				shouldCamelize,
			);
			yield `: (`;
			if (prop.exp && prop.exp.constType !== CompilerDOM.ConstantTypes.CAN_STRINGIFY) { // style='z-index: 2' will compile to {'z-index':'2'}
				const isShorthand = prop.arg?.loc.start.offset === prop.exp?.loc.start.offset; // vue 3.4+
				if (!isShorthand) {
					yield* generateInterpolation(
						options,
						ctx,
						prop.exp.loc.source,
						prop.exp.loc,
						prop.exp.loc.start.offset,
						defaultCodeFeatures,
						'(',
						')',
					);
				} else {
					const propVariableName = camelize(prop.exp.loc.source);

					if (variableNameRegex.test(propVariableName)) {
						if (!ctx.hasLocalVariable(propVariableName)) {
							ctx.accessGlobalVariable(propVariableName, prop.exp.loc.start.offset);
							yield `__VLS_ctx.`;
						}
						yield* generateCamelized(
							prop.exp.loc.source,
							prop.exp.loc.start.offset,
							defaultCodeFeatures,
						);
						if (mode === 'normal') {
							yield [
								'',
								'template',
								prop.exp.loc.end.offset,
								{
									__hint: {
										setting: 'vue.inlayHints.vBindShorthand',
										label: `="${propVariableName}"`,
										tooltip: [
											`This is a shorthand for \`${prop.exp.loc.source}="${propVariableName}"\`.`,
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
			yield `)`;
			if (mode === 'normal') {
				yield [
					'',
					'template',
					prop.loc.end.offset,
					ctx.codeFeatures.verification,
				];
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
				&& (node.tag === 'transition' || node.tag === 'Transition')
				&& prop.name === 'persisted'
			) {
				// Vue 2 Transition doesn't support "persisted" property but `@vue/compiler-dom always adds it (#3881)
				continue;
			}

			const shouldCamelize = canCamelize
				&& hyphenateAttr(prop.name) === prop.name
				&& !options.vueCompilerOptions.htmlAttributes.some(pattern => minimatch(prop.name, pattern));

			if (mode === 'normal') {
				yield [
					'',
					'template',
					prop.loc.start.offset,
					ctx.codeFeatures.verification,
				];
			}
			yield* generateObjectProperty(
				options,
				ctx,
				prop.name,
				prop.loc.start.offset,
				shouldCamelize
					? {
						...attrCodeFeatures,
						navigation: attrCodeFeatures.navigation
							? {
								resolveRenameNewName: camelize,
								resolveRenameEditText: hyphenateAttr,
							}
							: false,
					}
					: attrCodeFeatures,
				(prop.loc as any).name_1 ?? ((prop.loc as any).name_1 = {}),
				shouldCamelize,
			);
			yield `: (`;
			if (prop.value) {
				yield* generateAttrValue(prop.value, defaultCodeFeatures);
			}
			else {
				yield `true`;
			}
			yield `)`;
			if (mode === 'normal') {
				yield [
					'',
					'template',
					prop.loc.end.offset,
					ctx.codeFeatures.verification,
				];
			}
			yield `, `;
		}
		else if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'bind'
			&& !prop.arg
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			yield [
				'',
				'template',
				prop.exp.loc.start.offset,
				ctx.codeFeatures.verification,
			];
			yield `...`;
			yield* generateInterpolation(
				options,
				ctx,
				prop.exp.content,
				prop.exp.loc,
				prop.exp.loc.start.offset,
				defaultCodeFeatures,
				'(',
				')',
			);
			yield [
				'',
				'template',
				prop.exp.loc.end.offset,
				ctx.codeFeatures.verification,
			];
			yield `, `;
		}
		else {
			// comment this line to avoid affecting comments in prop expressions
			// tsCodeGen.addText("/* " + [prop.type, prop.name, prop.arg?.loc.source, prop.exp?.loc.source, prop.loc.source].join(", ") + " */ ");
		}
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
		yield ['', 'template', start, features];
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

import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import { isMatch } from 'picomatch';
import type { Code, VueCodeInformation, VueCompilerOptions } from '../../types';
import { hyphenateAttr, hyphenateTag, normalizeAttributeValue } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import { names } from '../names';
import { identifierRE, newLine } from '../utils';
import { Boundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import { generateUnicode } from '../utils/unicode';
import type { TemplateCodegenContext } from './context';
import { generateModifiers } from './elementDirectives';
import { generateEventArg, generateEventExpression } from './elementEvents';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation, shouldIdentifierSkipped } from './interpolation';
import { generateObjectProperty } from './objectProperty';

export interface FailedPropExpressions {
	node: CompilerDOM.SimpleExpressionNode;
	prefix: string;
	suffix: string;
}

export function* generateElementProps(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	props: CompilerDOM.ElementNode['props'],
	checkUnknownProps: boolean,
	failedPropExps?: FailedPropExpressions[],
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
			const shouldCamelize = getShouldCamelize(options, node, prop, propName);
			const features = getPropsCodeFeatures(checkUnknownProps);

			if (shouldSpread) {
				yield `...{ `;
			}
			const boundary = yield* Boundary.start(
				'template',
				prop.loc.start.offset,
				prop.loc.end.offset,
				codeFeatures.verification,
			);
			if (prop.arg) {
				yield* generateObjectProperty(
					options,
					ctx,
					propName,
					prop.arg.loc.start.offset,
					features,
					shouldCamelize,
				);
			}
			else {
				const boundary2 = yield* Boundary.start(
					'template',
					prop.loc.start.offset,
					prop.loc.start.offset + 'v-model'.length,
					codeFeatures.withoutHighlightAndCompletion,
				);
				yield propName;
				yield boundary2.end();
			}
			yield `: `;
			const argLoc = prop.arg?.loc ?? prop.loc;
			const boundary3 = yield* Boundary.start(
				'template',
				argLoc.start.offset,
				argLoc.end.offset,
				codeFeatures.verification,
			);
			yield* generatePropExp(options, ctx, prop, prop.exp);
			yield boundary3.end();
			yield boundary.end();
			if (shouldSpread) {
				yield ` }`;
			}
			yield `,${newLine}`;

			if (isComponent && prop.name === 'model' && prop.modifiers.length) {
				const propertyName = prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					? !prop.arg.isStatic
						? `[${names.tryAsConstant}(\`\${${prop.arg.content}}Modifiers\`)]`
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
			const shouldCamelize = getShouldCamelize(options, node, prop, prop.name);
			const features = getPropsCodeFeatures(checkUnknownProps);

			if (shouldSpread) {
				yield `...{ `;
			}
			const boundary = yield* Boundary.start(
				'template',
				prop.loc.start.offset,
				prop.loc.end.offset,
				codeFeatures.verification,
			);
			const prefix = options.template.content.slice(prop.loc.start.offset, prop.loc.start.offset + 1);
			if (prefix === '.' || prefix === '#') {
				// Pug shorthand syntax
				for (const char of prop.name) {
					yield [char, 'template', prop.loc.start.offset, features];
				}
			}
			else {
				yield* generateObjectProperty(
					options,
					ctx,
					prop.name,
					prop.loc.start.offset,
					features,
					shouldCamelize,
				);
			}
			yield `: `;
			if (prop.name === 'style') {
				yield `{}`;
			}
			else if (prop.value) {
				yield* generateAttrValue(prop.value, codeFeatures.withoutNavigation);
			}
			else {
				yield `true`;
			}
			yield boundary.end();
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
				failedPropExps?.push({ node: prop.exp, prefix: `(`, suffix: `)` });
			}
			else {
				const boundary = yield* Boundary.start(
					'template',
					prop.exp.loc.start.offset,
					prop.exp.loc.end.offset,
					codeFeatures.verification,
				);
				yield `...`;
				yield* generatePropExp(
					options,
					ctx,
					prop,
					prop.exp,
				);
				yield boundary.end();
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

		if (identifierRE.test(propVariableName)) {
			const codes = generateCamelized(
				exp.loc.source,
				'template',
				exp.loc.start.offset,
				{
					...codeFeatures.withoutHighlightAndCompletion,
					__shorthandExpression: 'html',
				},
			);

			if (shouldIdentifierSkipped(ctx, propVariableName)) {
				yield* codes;
			}
			else if (options.setupRefs.has(propVariableName)) {
				yield* codes;
				yield `.value`;
			}
			else {
				ctx.accessVariable('template', propVariableName, exp.loc.start.offset);
				yield names.ctx;
				yield `.`;
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
	const [content, offset] = normalizeAttributeValue(node);
	yield quote;
	yield* generateUnicode(content, offset, features);
	yield quote;
}

function getShouldCamelize(
	options: TemplateCodegenOptions,
	node: CompilerDOM.ElementNode,
	prop: CompilerDOM.AttributeNode | CompilerDOM.DirectiveNode,
	propName: string,
) {
	return (
		node.tagType === CompilerDOM.ElementTypes.COMPONENT
		|| node.tagType === CompilerDOM.ElementTypes.SLOT
	) && (
		prop.type !== CompilerDOM.NodeTypes.DIRECTIVE
		|| prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic
	)
		&& hyphenateAttr(propName) === propName
		&& (
			node.tagType === CompilerDOM.ElementTypes.SLOT
			|| !options.vueCompilerOptions.htmlAttributes.some(pattern => isMatch(propName, pattern))
		);
}

function getPropsCodeFeatures(checkUnknownProps: boolean): VueCodeInformation {
	return {
		...codeFeatures.withoutHighlightAndCompletion,
		...checkUnknownProps
			? codeFeatures.verification
			: codeFeatures.doNotReportTs2353AndTs2561,
		__propsCompletion: true,
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

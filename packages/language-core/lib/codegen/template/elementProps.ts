import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import { isMatch } from 'picomatch';
import type { Code, VueCodeInformation, VueCompilerOptions } from '../../types';
import { hyphenateAttr, hyphenateTag, normalizeAttributeValue } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { createVBindShorthandInlayHintInfo } from '../inlayHints';
import { names } from '../names';
import { identifierRegex, newLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import { generateUnicode } from '../utils/unicode';
import type { TemplateCodegenContext } from './context';
import { generateModifiers } from './elementDirectives';
import { generateEventArg, generateEventExpression } from './elementEvents';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';

export interface FailGeneratedExpression {
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
	failGeneratedExpressions?: FailGeneratedExpression[],
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
				failGeneratedExpressions?.push({ node: prop.arg, prefix: `(`, suffix: `)` });
				failGeneratedExpressions?.push({ node: prop.exp, prefix: `() => {`, suffix: `}` });
			}
			else if (
				!prop.arg
				&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			) {
				failGeneratedExpressions?.push({ node: prop.exp, prefix: `(`, suffix: `)` });
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
					failGeneratedExpressions?.push({ node: prop.exp, prefix: `(`, suffix: `)` });
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
			const token = yield* startBoundary(
				'template',
				prop.loc.start.offset,
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
				const token2 = yield* startBoundary(
					'template',
					prop.loc.start.offset,
					codeFeatures.withoutHighlightAndCompletion,
				);
				yield propName;
				yield endBoundary(token2, prop.loc.start.offset + 'v-model'.length);
			}
			yield `: `;
			const argLoc = prop.arg?.loc ?? prop.loc;
			const token3 = yield* startBoundary('template', argLoc.start.offset, codeFeatures.verification);
			yield* generatePropExp(options, ctx, prop, prop.exp);
			yield endBoundary(token3, argLoc.end.offset);
			yield endBoundary(token, prop.loc.end.offset);
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
			const shouldCamelize = isComponent && getShouldCamelize(options, prop, prop.name);
			const features = getPropsCodeFeatures(strictPropsCheck);

			if (shouldSpread) {
				yield `...{ `;
			}
			const token = yield* startBoundary('template', prop.loc.start.offset, codeFeatures.verification);
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
			yield endBoundary(token, prop.loc.end.offset);
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
				failGeneratedExpressions?.push({ node: prop.exp, prefix: `(`, suffix: `)` });
			}
			else {
				const token = yield* startBoundary('template', prop.exp.loc.start.offset, codeFeatures.verification);
				yield `...`;
				yield* generatePropExp(
					options,
					ctx,
					prop,
					prop.exp,
				);
				yield endBoundary(token, prop.exp.loc.end.offset);
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
				{
					...codeFeatures.withoutHighlightAndCompletion,
					__shorthandExpression: 'html',
				},
			);

			if (ctx.scopes.some(scope => scope.has(propVariableName))) {
				yield* codes;
			}
			else if (options.setupRefs.has(propVariableName)) {
				yield* codes;
				yield `.value`;
			}
			else {
				ctx.recordComponentAccess('template', propVariableName, exp.loc.start.offset);
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

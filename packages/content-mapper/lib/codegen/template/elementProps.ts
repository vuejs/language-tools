import { SpanMapKind } from '@volar/language-core';
import * as CompilerDOM from '@vue/compiler-dom';
import {
	type Code,
	getModelPropName,
	hyphenateAttr,
	navigationFeatures,
	normalizeAttributeValue,
	scriptFeatures,
	semanticFeatures,
	type VueCodeMarker,
} from '@vue/language-core';
import { Boundary } from '@vue/language-core/lib/utils/boundary';
import { camelize } from '@vue/shared';
import { names } from '../names';
import { asType, identifierRE, newLine } from '../utils';
import { generateCamelized } from '../utils/camelized';
import { generateUnicode } from '../utils/unicode';
import type { TemplateCodegenContext } from './context';
import { generateModifiers } from './elementDirectives';
import { generateEventArg, generateEventExpression, getEventArgName } from './elementEvents';
import type { TemplateCodegenOptions } from './index';
import { generateIdentifier, generateInterpolation } from './interpolation';
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
	failedPropExps?: FailedPropExpressions[],
	// type of the object the props are passed to, if any
	attrsType?: string,
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
					yield* generateEventArg(prop.arg.loc.source, prop.arg.loc.start.offset);
					yield `: `;
					yield* generateEventExpression(
						options,
						ctx,
						prop,
						attrsType
							? `${names.EventArgs}<${attrsType}, '${getEventArgName(prop.arg.loc.source)}'>`
							: `any[]`,
					);
					yield `},`;
				}
				else {
					yield `...{ '${camelize('on-' + prop.arg.loc.source)}': ${asType('any', options.scriptLang)} },`;
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
				|| options.vueCompilerOptions.isDataAttribute(propName)
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
			const features = getPropsCodeFeatures();

			if (shouldSpread) {
				yield `...{ `;
			}
			const boundary = yield* Boundary.start(
				'template',
				prop.loc.start.offset,
				prop.loc.end.offset,
				{ features: 0 },
			);
			if (prop.arg) {
				// the key of a same-name shorthand maps to the name its value maps to
				const isShorthandName = prop.exp?.loc.start.offset === prop.arg.loc.start.offset
					&& propName === prop.arg.loc.source
					&& identifierRE.test(propName);
				yield* generateObjectProperty(
					options,
					ctx,
					propName,
					prop.arg.loc.start.offset,
					isShorthandName ? { ...features, kind: SpanMapKind.Atom } : features,
					shouldCamelize,
				);
			}
			else {
				const boundary2 = yield* Boundary.start(
					'template',
					prop.loc.start.offset,
					prop.loc.start.offset + 'v-model'.length,
					{ features: semanticFeatures | navigationFeatures },
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
				{ features: 0 },
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
			if (options.vueCompilerOptions.isDataAttribute(prop.name)) {
				continue;
			}

			const shouldSpread = prop.name === 'style' || prop.name === 'class';
			const shouldCamelize = getShouldCamelize(options, node, prop, prop.name);
			const features = getPropsCodeFeatures();

			if (shouldSpread) {
				yield `...{ `;
			}
			const boundary = yield* Boundary.start(
				'template',
				prop.loc.start.offset,
				prop.loc.end.offset,
				{ features: 0 },
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
				yield* generateAttrValue(prop.value, { features: scriptFeatures & ~navigationFeatures });
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
					{ features: 0 },
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
			{ features: scriptFeatures },
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
				{ features: semanticFeatures | navigationFeatures, kind: SpanMapKind.Atom },
			);
			yield* generateIdentifier(
				options,
				ctx,
				codes,
				ctx.getExpression(options.template, exp.loc.start.offset, propVariableName).references[0]!,
				'template',
				exp.loc.start.offset,
				exp.loc.end.offset,
			);
		}
	}
}

function* generateAttrValue(
	node: CompilerDOM.TextNode,
	features: VueCodeMarker,
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
			|| !options.vueCompilerOptions.isHtmlAttribute(propName)
		);
}

function getPropsCodeFeatures(): VueCodeMarker {
	return { features: semanticFeatures | navigationFeatures };
}

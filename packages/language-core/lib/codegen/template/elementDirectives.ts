import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { endOfLine } from '../utils';
import { generateCamelized } from '../utils/camelized';
import { generateStringLiteralKey } from '../utils/stringLiteralKey';
import { wrapWith } from '../utils/wrapWith';
import type { TemplateCodegenContext } from './context';
import { generatePropExp } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';

const builtInDirectives = new Set([
	'cloak',
	'html',
	'memo',
	'once',
	'show',
	'text',
]);

export function* generateElementDirectives(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	for (const prop of node.props) {
		if (
			prop.type !== CompilerDOM.NodeTypes.DIRECTIVE
			|| prop.name === 'slot'
			|| prop.name === 'on'
			|| prop.name === 'model'
			|| prop.name === 'bind'
		) {
			continue;
		}
		ctx.accessExternalVariable(camelize('v-' + prop.name), prop.loc.start.offset);

		yield* wrapWith(
			prop.loc.start.offset,
			prop.loc.end.offset,
			codeFeatures.verification,
			`__VLS_asFunctionalDirective(`,
			...generateIdentifier(options, prop),
			`)(null!, { ...__VLS_directiveBindingRestFields, `,
			...generateArg(options, ctx, prop),
			...generateModifiers(options, ctx, prop),
			...generateValue(options, ctx, prop),
			` }, null!, null!)`,
		);
		yield endOfLine;
	}
}

function* generateIdentifier(
	options: TemplateCodegenOptions,
	prop: CompilerDOM.DirectiveNode,
): Generator<Code> {
	const rawName = 'v-' + prop.name;
	yield* wrapWith(
		prop.loc.start.offset,
		prop.loc.start.offset + rawName.length,
		codeFeatures.verification,
		`__VLS_directives.`,
		...generateCamelized(
			rawName,
			'template',
			prop.loc.start.offset,
			{
				...codeFeatures.withoutHighlightAndCompletion,
				verification: options.vueCompilerOptions.checkUnknownDirectives && !builtInDirectives.has(prop.name),
			},
		),
	);
}

function* generateArg(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
): Generator<Code> {
	const { arg } = prop;
	if (arg?.type !== CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		return;
	}

	const startOffset = arg.loc.start.offset + arg.loc.source.indexOf(arg.content);

	yield* wrapWith(
		startOffset,
		startOffset + arg.content.length,
		codeFeatures.verification,
		`arg`,
	);
	yield `: `;
	if (arg.isStatic) {
		yield* generateStringLiteralKey(
			arg.content,
			startOffset,
			codeFeatures.all,
		);
	}
	else {
		yield* generateInterpolation(
			options,
			ctx,
			'template',
			codeFeatures.all,
			arg.content,
			startOffset,
			`(`,
			`)`,
		);
	}
	yield `, `;
}

export function* generateModifiers(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	propertyName: string = 'modifiers',
): Generator<Code> {
	const { modifiers } = prop;
	if (!modifiers.length) {
		return;
	}

	const startOffset = modifiers[0].loc.start.offset - 1;
	const endOffset = modifiers.at(-1)!.loc.end.offset;

	yield* wrapWith(
		startOffset,
		endOffset,
		codeFeatures.verification,
		propertyName,
	);
	yield `: { `;
	for (const mod of modifiers) {
		yield* generateObjectProperty(
			options,
			ctx,
			mod.content,
			mod.loc.start.offset,
			codeFeatures.withoutHighlight,
		);
		yield `: true, `;
	}
	yield `}, `;
}

function* generateValue(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
): Generator<Code> {
	const { exp } = prop;
	if (exp?.type !== CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		return;
	}

	yield* wrapWith(
		exp.loc.start.offset,
		exp.loc.end.offset,
		codeFeatures.verification,
		`value`,
	);
	yield `: `;
	yield* generatePropExp(
		options,
		ctx,
		prop,
		exp,
	);
}

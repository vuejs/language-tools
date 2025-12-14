import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import * as names from '../names';
import { endOfLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import { generateStringLiteralKey } from '../utils/stringLiteralKey';
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
		const token = yield* startBoundary('template', prop.loc.start.offset, codeFeatures.verification);
		yield `__VLS_asFunctionalDirective(`;
		yield* generateIdentifier(options, ctx, prop);
		yield `, {} as import('${options.vueCompilerOptions.lib}').ObjectDirective)(null!, { ...__VLS_directiveBindingRestFields, `;
		yield* generateArg(options, ctx, prop);
		yield* generateModifiers(options, ctx, prop);
		yield* generateValue(options, ctx, prop);
		yield ` }, null!, null!)`;
		yield endBoundary(token, prop.loc.end.offset);
		yield endOfLine;
	}
}

function* generateIdentifier(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
): Generator<Code> {
	const rawName = 'v-' + prop.name;
	const startOffset = prop.loc.start.offset;
	const token = yield* startBoundary('template', startOffset, codeFeatures.verification);
	yield names.directives;
	yield `.`;
	yield* generateCamelized(
		rawName,
		'template',
		prop.loc.start.offset,
		{
			...codeFeatures.withoutHighlightAndCompletion,
			verification: options.vueCompilerOptions.checkUnknownDirectives && !builtInDirectives.has(prop.name),
		},
	);
	if (!builtInDirectives.has(prop.name)) {
		ctx.recordComponentAccess('template', camelize(rawName), prop.loc.start.offset);
	}
	yield endBoundary(token, startOffset + rawName.length);
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
	const token = yield* startBoundary('template', startOffset, codeFeatures.verification);
	yield `arg`;
	yield endBoundary(token, startOffset + arg.content.length);
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
			options.template,
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
	const startOffset = modifiers[0]!.loc.start.offset - 1;
	const endOffset = modifiers.at(-1)!.loc.end.offset;
	const token = yield* startBoundary('template', startOffset, codeFeatures.verification);
	yield propertyName;
	yield endBoundary(token, endOffset);
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
	const token = yield* startBoundary('template', exp.loc.start.offset, codeFeatures.verification);
	yield `value`;
	yield endBoundary(token, exp.loc.end.offset);
	yield `: `;
	yield* generatePropExp(
		options,
		ctx,
		prop,
		exp,
	);
}

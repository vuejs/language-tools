import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, isBuiltInDirective } from '@vue/shared';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { endOfLine } from '../utils';
import { Boundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import { generateStringLiteralKey } from '../utils/stringLiteralKey';
import type { TemplateCodegenContext } from './context';
import { generatePropExp } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';

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
		const boundary = yield* Boundary.start('template', prop.loc.start.offset, codeFeatures.verification);
		if (options.isVapor && !isBuiltInDirective(prop.name)) {
			// vapor custom directives receive a value getter instead of a vdom binding object
			yield* generateIdentifier(options, ctx, prop);
			yield `(null!, `;
			yield* generateValue(options, ctx, prop, false);
			yield `, `;
			yield* generateArg(options, ctx, prop, false);
			yield* generateModifiers(options, ctx, prop, 'modifiers', false);
			yield `)`;
		}
		else {
			yield `${names.asFunctionalDirective}(`;
			yield* generateIdentifier(options, ctx, prop);
			yield `, {} as import('${options.vueCompilerOptions.lib}').ObjectDirective)(null!, { ...${names.directiveBindingRestFields}, `;
			yield* generateArg(options, ctx, prop);
			yield* generateModifiers(options, ctx, prop);
			yield* generateValue(options, ctx, prop);
			yield ` }, null!, null!)`;
		}
		yield boundary.end(prop.loc.end.offset);
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
	const boundary = yield* Boundary.start('template', startOffset, codeFeatures.verification);
	yield names.directives;
	yield `.`;
	yield* generateCamelized(
		rawName,
		'template',
		prop.loc.start.offset,
		{
			...codeFeatures.withoutHighlightAndCompletion,
			verification: options.vueCompilerOptions.checkUnknownDirectives && !isBuiltInDirective(prop.name),
		},
	);
	if (!isBuiltInDirective(prop.name)) {
		ctx.accessVariable('template', camelize(rawName), prop.loc.start.offset);
	}
	yield boundary.end(startOffset + rawName.length);
}

function* generateArg(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	asBindingProperty = true,
): Generator<Code> {
	const { arg } = prop;
	if (arg?.type !== CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		if (!asBindingProperty) {
			yield `undefined, `;
		}
		return;
	}

	const startOffset = arg.loc.start.offset + arg.loc.source.indexOf(arg.content);
	if (asBindingProperty) {
		const boundary = yield* Boundary.start('template', startOffset, codeFeatures.verification);
		yield `arg`;
		yield boundary.end(startOffset + arg.content.length);
		yield `: `;
	}
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
	asBindingProperty = true,
): Generator<Code> {
	const { modifiers } = prop;
	if (!modifiers.length) {
		if (!asBindingProperty) {
			yield `undefined`;
		}
		return;
	}
	if (asBindingProperty) {
		const startOffset = modifiers[0]!.loc.start.offset - 1;
		const endOffset = modifiers.at(-1)!.loc.end.offset;
		const boundary = yield* Boundary.start('template', startOffset, codeFeatures.verification);
		yield propertyName;
		yield boundary.end(endOffset);
		yield `: `;
	}
	yield `{ `;
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
	yield `}`;
	if (asBindingProperty) {
		yield `, `;
	}
}

function* generateValue(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	asBindingProperty = true,
): Generator<Code> {
	const { exp } = prop;
	if (exp?.type !== CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		if (!asBindingProperty) {
			yield `undefined`;
		}
		return;
	}
	const boundary = yield* Boundary.start('template', exp.loc.start.offset, codeFeatures.verification);
	if (asBindingProperty) {
		yield `value`;
		yield boundary.end(exp.loc.end.offset);
		yield `: `;
		yield* generatePropExp(options, ctx, prop, exp);
	}
	else {
		yield `() => `;
		yield* generatePropExp(options, ctx, prop, exp);
		yield boundary.end(exp.loc.end.offset);
	}
}

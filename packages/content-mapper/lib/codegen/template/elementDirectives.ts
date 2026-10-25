import * as CompilerDOM from '@vue/compiler-dom';
import {
	type Code,
	completionFeatures,
	navigationFeatures,
	scriptFeatures,
	semanticFeatures,
} from '@vue/language-core';
import { Boundary, synthesizedIgnore } from '@vue/language-core/lib/utils/boundary';
import { camelize, isBuiltInDirective } from '@vue/shared';
import { names } from '../names';
import { asType, endOfLine, newLine } from '../utils';
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
		if (options.isVapor && !isBuiltInDirective(prop.name)) {
			const boundary = yield* Boundary.start(
				'template',
				prop.loc.start.offset,
				prop.loc.end.offset,
				{ features: 0 },
			);
			// vapor custom directives receive a value getter instead of a vdom binding object
			yield* generateIdentifier(ctx, prop);
			yield `(${names.nonNull}(null), `;
			yield* generateValue(options, ctx, prop, false);
			yield* generateArg(options, ctx, prop, false);
			yield* generateModifiers(options, ctx, prop, 'modifiers', false);
			yield `)`;
			yield boundary.end();
			yield endOfLine;
		}
		else {
			const hookVar = ctx.getInternalVariable();
			yield `const ${hookVar} = ${names.asFunctionalDirective}(`;
			yield* generateIdentifier(ctx, prop);
			yield `, ${
				asType(`import('${options.vueCompilerOptions.lib}').ObjectDirective`, options.scriptLang)
			})${endOfLine}`;
			const boundary = yield* Boundary.start(
				'template',
				prop.loc.start.offset,
				prop.loc.end.offset,
				{ features: 0 },
			);
			yield `${hookVar}(${names.nonNull}(null), { ...${names.directiveBindingRestFields}, `;
			yield* generateArg(options, ctx, prop);
			yield* generateModifiers(options, ctx, prop);
			yield* generateValue(options, ctx, prop);
			// Vue invokes hooks with all four arguments regardless of the declared
			// arity; the trailing args are sized to the hook's own params, so generic
			// and overloaded hooks are checked without rebuilding their signatures.
			yield `},${newLine}...${names.directiveHookArgsRest}(${hookVar}))`;
			yield boundary.end();
			yield endOfLine;
		}
	}
}

function* generateIdentifier(
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
): Generator<Code> {
	const rawName = 'v-' + prop.name;
	const startOffset = prop.loc.start.offset;
	const boundary = yield* Boundary.start(
		'template',
		startOffset,
		startOffset + rawName.length,
		{ features: 0 },
	);
	yield names.directives;
	yield `.`;
	const builtIn = isBuiltInDirective(prop.name);
	const ignore = builtIn ? yield* Boundary.start('template', 0, 0, synthesizedIgnore) : undefined;
	yield* generateCamelized(rawName, 'template', prop.loc.start.offset, {
		features: semanticFeatures | navigationFeatures,
	});
	if (ignore) {
		yield ignore.end();
	}
	else {
		ctx.accessVariable('template', camelize(rawName), prop.loc.start.offset, false, rawName);
	}
	yield boundary.end();
}

function* generateArg(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	asBindingProperty = true,
): Generator<Code> {
	const { arg } = prop;
	if (arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const startOffset = arg.loc.start.offset + arg.loc.source.indexOf(arg.content);
		if (asBindingProperty) {
			const boundary = yield* Boundary.start(
				'template',
				startOffset,
				startOffset + arg.content.length,
				{ features: 0 },
			);
			yield `arg`;
			yield boundary.end();
			yield `: `;
		}
		if (arg.isStatic) {
			yield* generateStringLiteralKey(
				arg.content,
				startOffset,
				{ features: scriptFeatures },
			);
		}
		else {
			yield* generateInterpolation(
				options,
				ctx,
				options.template,
				{ features: scriptFeatures },
				arg.content,
				startOffset,
				`(`,
				`)`,
			);
		}
		yield `, `;
	}
	else if (!asBindingProperty) {
		yield `undefined, `;
	}
}

export function* generateModifiers(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	propertyName: string = 'modifiers',
	asBindingProperty = true,
): Generator<Code> {
	const { modifiers } = prop;
	if (modifiers.length) {
		if (asBindingProperty) {
			const boundary = yield* Boundary.start(
				'template',
				modifiers[0]!.loc.start.offset - 1,
				modifiers.at(-1)!.loc.end.offset,
				{ features: 0 },
			);
			yield propertyName;
			yield boundary.end();
			yield `: `;
		}
		yield `{ `;
		for (const mod of modifiers) {
			yield* generateObjectProperty(
				options,
				ctx,
				mod.content,
				mod.loc.start.offset,
				{ features: semanticFeatures | navigationFeatures | completionFeatures },
			);
			yield `: true, `;
		}
		yield `}, `;
	}
	else if (!asBindingProperty) {
		yield `undefined, `;
	}
}

function* generateValue(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	asBindingProperty = true,
): Generator<Code> {
	const { exp } = prop;
	if (exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const boundary = yield* Boundary.start(
			'template',
			exp.loc.start.offset,
			exp.loc.end.offset,
			{ features: 0 },
		);
		if (asBindingProperty) {
			yield `value`;
			yield boundary.end();
			yield `: `;
			yield* generatePropExp(options, ctx, prop, exp);
		}
		else {
			yield `() => `;
			yield* generatePropExp(options, ctx, prop, exp);
			yield boundary.end();
		}
		yield `, `;
	}
	else if (!asBindingProperty) {
		yield `undefined, `;
	}
}

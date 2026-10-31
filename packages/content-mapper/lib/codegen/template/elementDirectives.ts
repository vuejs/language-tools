import * as CompilerDOM from '@vue/compiler-dom';
import { completionFeatures, navigationFeatures, scriptFeatures, semanticFeatures } from '@vue/language-core';
import { camelize, isBuiltInDirective } from '@vue/shared';
import { names } from '../names';
import { Boundary, mapped, synthesizedIgnore, type TsCode } from '../tsCode';
import { asType, endOfLine, identifierRE, newLine } from '../writers';
import { generateCamelized } from '../writers/camelized';
import { generateStringLiteralKey } from '../writers/stringLiteralKey';
import type { TemplateCodegenContext } from './context';
import { generatePropExp } from './elementProps';
import type { TemplateCodegenOptions } from './index';
import { generateIdentifier, generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';

export function* generateElementDirectives(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
): Generator<TsCode> {
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
				options.template,
				prop.loc.start.offset,
				prop.loc.end.offset,
				{ features: 0 },
			);
			// vapor custom directives receive a value getter instead of a vdom binding object
			yield* generateDirectiveName(options, ctx, prop);
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
			yield* generateDirectiveName(options, ctx, prop);
			yield `, ${
				asType(`import('${options.vueCompilerOptions.lib}').ObjectDirective`, options.scriptLang)
			})${endOfLine}`;
			const boundary = yield* Boundary.start(
				options.template,
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

function* generateDirectiveName(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
): Generator<TsCode> {
	const rawName = 'v-' + prop.name;
	const name = camelize(rawName);
	const startOffset = prop.loc.start.offset;
	const endOffset = startOffset + rawName.length;
	const nameCodes = generateCamelized(rawName, options.template, startOffset, {
		features: semanticFeatures | navigationFeatures,
	});
	// Like `@vue/compiler-sfc`, a directive refers to the setup binding of its name;
	// referencing it like a template expression links it to the binding.
	if (options.localDirectives.has(name)) {
		yield* generateIdentifier(
			options,
			ctx,
			nameCodes,
			ctx.getExpression(options.template, startOffset, name).references[0]!,
			options.template,
			startOffset,
			endOffset,
		);
		return;
	}
	const boundary = yield* Boundary.start(options.template, startOffset, endOffset, { features: 0 });
	const optionKey = options.optionDirectives.get(name);
	// A directive that resolves to a listed key of the `directives` option is read by that key: a type that renames the
	// keys into the template names would be a key-remapping mapped type, whose properties TypeScript links to no
	// declaration (the checker links them only when the mapped type is not `Remapping`), so references and
	// definitions would not link the directive to its key.
	if (optionKey !== undefined) {
		yield names.directivesOption;
		const quoted = !identifierRE.test(optionKey);
		yield quoted ? `[` : `.`;
		const key = yield* Boundary.start(options.template, startOffset, endOffset, {
			features: semanticFeatures | navigationFeatures,
		});
		yield mapped(quoted ? `'${optionKey}'` : optionKey, options.template, startOffset, undefined);
		yield key.end();
		if (quoted) {
			yield `]`;
		}
		yield boundary.end();
		return;
	}
	yield names.directives;
	yield `.`;
	const builtIn = isBuiltInDirective(prop.name);
	const ignore = builtIn ? yield* Boundary.start(options.template, 0, 0, synthesizedIgnore) : undefined;
	yield* nameCodes;
	if (ignore) {
		yield ignore.end();
	}
	else {
		ctx.accessLog.push(name);
	}
	yield boundary.end();
}

function* generateArg(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
	asBindingProperty = true,
): Generator<TsCode> {
	const { arg } = prop;
	if (arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const startOffset = arg.loc.start.offset + arg.loc.source.indexOf(arg.content);
		if (asBindingProperty) {
			const boundary = yield* Boundary.start(
				options.template,
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
				options.template,
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
): Generator<TsCode> {
	const { modifiers } = prop;
	if (modifiers.length) {
		if (asBindingProperty) {
			const boundary = yield* Boundary.start(
				options.template,
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
): Generator<TsCode> {
	const { exp } = prop;
	if (exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const boundary = yield* Boundary.start(
			options.template,
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

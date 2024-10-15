import * as CompilerDOM from '@vue/compiler-dom';
import { camelize } from '@vue/shared';
import type { Code } from '../../types';
import { hyphenateAttr } from '../../utils/shared';
import { endOfLine, wrapWith } from '../common';
import { generateCamelized } from './camelized';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';
import { generateStringLiteralKey } from './stringLiteralKey';

export function* generateElementDirectives(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode
): Generator<Code> {
	for (const prop of node.props) {
		if (
			prop.type !== CompilerDOM.NodeTypes.DIRECTIVE
			|| prop.name === 'slot'
			|| prop.name === 'on'
			|| prop.name === 'model'
			|| prop.name === 'bind'
			|| prop.name === 'scope'
			|| prop.name === 'data'
		) {
			continue;
		}
		ctx.accessExternalVariable(camelize('v-' + prop.name), prop.loc.start.offset);

		yield* wrapWith(
			prop.loc.start.offset,
			prop.loc.end.offset,
			ctx.codeFeatures.verification,
			`__VLS_asFunctionalDirective(`,
			...generateIdentifier(ctx, prop),
			`)(null!, { ...__VLS_directiveBindingRestFields, `,
			...generateArg(options, ctx, prop),
			...generateModifiers(options, ctx, prop),
			...generateValue(options, ctx, prop),
			`}, null!, null!)`
		);
		yield endOfLine;
	}
}

function* generateIdentifier(
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode
): Generator<Code> {
	const rawName = 'v-' + prop.name;
	yield* wrapWith(
		prop.loc.start.offset,
		prop.loc.start.offset + rawName.length,
		ctx.codeFeatures.verification,
		`__VLS_directives.`,
		...generateCamelized(
			rawName,
			prop.loc.start.offset,
			{
				...ctx.codeFeatures.all,
				verification: false,
				completion: {
					// fix https://github.com/vuejs/language-tools/issues/1905
					isAdditional: true,
				},
				navigation: {
					resolveRenameNewName: camelize,
					resolveRenameEditText: getPropRenameApply(prop.name),
				},
			}
		)
	);
}

function* generateArg(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode
): Generator<Code> {
	const { arg } = prop;
	if (arg?.type !== CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		return;
	}

	const startOffset = arg.loc.start.offset + arg.loc.source.indexOf(arg.content);

	yield* wrapWith(
		startOffset,
		startOffset + arg.content.length,
		ctx.codeFeatures.verification,
		'arg'
	);
	yield ': ';
	if (arg.isStatic) {
		yield* generateStringLiteralKey(
			arg.content,
			startOffset,
			ctx.codeFeatures.withoutHighlight
		);
	}
	else {
		yield* generateInterpolation(
			options,
			ctx,
			arg.content,
			arg.loc,
			startOffset,
			ctx.codeFeatures.all,
			'(',
			')'
		);
	}
	yield ', ';
}

function* generateModifiers(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode
): Generator<Code> {
	if (options.vueCompilerOptions.target < 3.5) {
		return;
	}

	yield 'modifiers: { ';
	for (const mod of prop.modifiers) {
		yield* generateObjectProperty(
			options,
			ctx,
			mod.content,
			mod.loc.start.offset,
			ctx.codeFeatures.withoutHighlight
		);
		yield ': true, ';
	}
	yield '}, ';
}

function* generateValue(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode
): Generator<Code> {
	if (prop.exp?.type !== CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		return;
	}

	yield* wrapWith(
		prop.exp.loc.start.offset,
		prop.exp.loc.end.offset,
		ctx.codeFeatures.verification,
		'value'
	);
	yield ': ';
	yield* wrapWith(
		prop.exp.loc.start.offset,
		prop.exp.loc.end.offset,
		ctx.codeFeatures.verification,
		...generateInterpolation(
			options,
			ctx,
			prop.exp.content,
			prop.exp.loc,
			prop.exp.loc.start.offset,
			ctx.codeFeatures.all,
			'(',
			')'
		)
	);
}

function getPropRenameApply(oldName: string) {
	return oldName === hyphenateAttr(oldName) ? hyphenateAttr : undefined;
}

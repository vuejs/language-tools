import * as CompilerDOM from '@vue/compiler-dom';
import { type Code, parseVForAliases, scriptFeatures } from '@vue/language-core';
import { names } from '../names';
import { asType, endOfLine, newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateTemplateChild } from './templateChild';

export function* generateVFor(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ForNode,
): Generator<Code> {
	const { source } = node.parseResult;
	const { leftExpressionRange, leftExpressionText, defaultInitializerRanges } = parseVForAliases(
		options.typescript,
		options.template,
		node,
	);

	// Evaluate the source before the loop bindings enter scope (`v-for="x in x"` reads the outer `x`);
	// destructuring defaults (`{ a, b = a }`) are interpolated after the declaration to see the sibling aliases.
	let sourceAlias: string | undefined;
	if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		sourceAlias = ctx.getInternalVariable();
		// tryAsConstant keeps inline literal sources from widening to `number[]` (#6067).
		yield `const ${sourceAlias} = ${names.tryAsConstant}(`;
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			{ features: scriptFeatures },
			source.content,
			source.loc.start.offset,
			`(`,
			`)`,
		);
		yield `)`;
		yield endOfLine;
	}

	ctx.enterBlockScope(node);

	yield `for (const [`;
	if (leftExpressionRange && leftExpressionText) {
		let lastOffset = 0;
		for (const [start, end] of defaultInitializerRanges) {
			if (start > lastOffset) {
				yield [
					leftExpressionText.slice(lastOffset, start),
					'template',
					leftExpressionRange.start + lastOffset,
					{ features: scriptFeatures },
				];
			}
			yield* generateInterpolation(
				options,
				ctx,
				options.template,
				{ features: scriptFeatures },
				leftExpressionText.slice(start, end),
				leftExpressionRange.start + start,
			);
			lastOffset = end;
		}
		if (lastOffset < leftExpressionText.length) {
			yield [
				leftExpressionText.slice(lastOffset),
				'template',
				leftExpressionRange.start + lastOffset,
				{ features: scriptFeatures },
			];
		}
	}
	yield `] of `;
	if (sourceAlias !== undefined) {
		yield `${names.vFor}(${names.nonNull}(`;
		yield sourceAlias;
		yield `))`; // #3102
	}
	else {
		yield asType('any', options.scriptLang);
	}
	yield `) {${newLine}`;

	const { inVFor } = ctx;
	ctx.inVFor = true;
	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child, false, true);
	}
	ctx.inVFor = inVFor;

	yield* ctx.exitBlockScope();
	yield `}${newLine}`;
}

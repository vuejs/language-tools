import * as CompilerDOM from '@vue/compiler-dom';
import { type CodeSource, parseVForAliases, scriptFeatures } from '@vue/language-core';
import { createSourceRewrite } from 'muggle-string';
import { names } from '../names';
import type { TsCode, TsCodeData } from '../tsCode';
import { asType, endOfLine, newLine } from '../writers';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateTemplateChild } from './templateChild';

export function* generateVFor(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ForNode,
): Generator<TsCode> {
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
		// the aliases are the text of the template, with the defaults in it as expressions of the template
		const rewrite = createSourceRewrite<CodeSource, { data: TsCodeData }>(options.template);
		for (const [start, end] of defaultInitializerRanges) {
			rewrite.replace(leftExpressionRange.start + start, leftExpressionRange.start + end, [
				...generateInterpolation(
					options,
					ctx,
					options.template,
					{ features: scriptFeatures },
					leftExpressionText.slice(start, end),
					leftExpressionRange.start + start,
				),
			]);
		}
		const codes: TsCode[] = [];
		rewrite.render(
			leftExpressionRange.start,
			leftExpressionRange.end,
			piece => codes.push(piece),
			{ data: { features: scriptFeatures } },
		);
		yield* codes;
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

	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child, false, true);
	}

	yield* ctx.exitBlockScope();
	yield `}${newLine}`;
}

import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { getStartEnd } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { asType, endOfLine, getTypeScriptAST, newLine } from '../utils';
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
	const { leftExpressionRange, leftExpressionText } = parseVForNode(node);
	const scope = ctx.scope();
	let bindingNames: string[] = [];
	const defaultInitializerRanges: [number, number][] = [];

	if (leftExpressionRange && leftExpressionText) {
		const wrap = `const [`;
		const collectAst = getTypeScriptAST(options.typescript, options.template, `${wrap}${leftExpressionText}]`);
		bindingNames = collectBindingNames(options.typescript, collectAst, collectAst);
		const declaration = (collectAst.statements[0] as ts.VariableStatement).declarationList.declarations[0]!;
		const initializers: ts.Expression[] = [];
		collectDefaultInitializers(options.typescript, declaration.name, initializers);
		for (const initializer of initializers) {
			const { start, end } = getStartEnd(options.typescript, initializer, collectAst);
			defaultInitializerRanges.push([start - wrap.length, end - wrap.length]);
		}
		defaultInitializerRanges.sort((a, b) => a[0] - b[0]);
	}

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
			codeFeatures.all,
			source.content,
			source.loc.start.offset,
			`(`,
			`)`,
		);
		yield `)`;
		yield endOfLine;
	}

	scope.declare(...bindingNames);

	yield `for (const [`;
	if (leftExpressionRange && leftExpressionText) {
		let lastOffset = 0;
		for (const [start, end] of defaultInitializerRanges) {
			if (start > lastOffset) {
				yield [
					leftExpressionText.slice(lastOffset, start),
					'template',
					leftExpressionRange.start + lastOffset,
					codeFeatures.all,
				];
			}
			yield* generateInterpolation(
				options,
				ctx,
				options.template,
				codeFeatures.all,
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
				codeFeatures.all,
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
		yield asType('{}', 'any', options.scriptLang);
	}
	yield `) {${newLine}`;

	const { inVFor } = ctx;
	ctx.inVFor = true;
	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child, false, true);
	}
	ctx.inVFor = inVFor;

	yield* scope.end();
	yield `}${newLine}`;
}

export function parseVForNode(node: CompilerDOM.ForNode) {
	const { value, key, index } = node.parseResult;
	const leftExpressionRange = (value || key || index)
		? {
			start: (value ?? key ?? index)!.loc.start.offset,
			end: (index ?? key ?? value)!.loc.end.offset,
		}
		: undefined;
	const leftExpressionText = leftExpressionRange
		? node.loc.source.slice(
			leftExpressionRange.start - node.loc.start.offset,
			leftExpressionRange.end - node.loc.start.offset,
		)
		: undefined;
	return {
		leftExpressionRange,
		leftExpressionText,
	};
}

function collectDefaultInitializers(
	ts: typeof import('typescript'),
	pattern: ts.BindingName,
	out: ts.Expression[],
) {
	if (ts.isIdentifier(pattern)) {
		return;
	}
	for (const element of pattern.elements) {
		if (!ts.isBindingElement(element)) {
			continue;
		}
		if (!ts.isIdentifier(element.name)) {
			collectDefaultInitializers(ts, element.name, out);
		}
		if (element.initializer) {
			out.push(element.initializer);
		}
	}
}

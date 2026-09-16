import * as CompilerDOM from '@vue/compiler-dom';
import { toString } from 'muggle-string';
import type { Code } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { getTypeScriptAST, newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation, getConditionBindings } from './interpolation';
import { generateTemplateChild } from './templateChild';

export function* generateVFor(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ForNode,
): Generator<Code> {
	const { source } = node.parseResult;
	const { leftExpressionRange, leftExpressionText } = parseVForNode(node);
	const endScope = ctx.startScope();
	const bindingNames: string[] = [];
	if (leftExpressionText) {
		const collectAst = getTypeScriptAST(options.typescript, options.template, `const [${leftExpressionText}]`);
		bindingNames.push(...collectBindingNames(options.typescript, collectAst, collectAst));
	}
	const sourceCodes: Code[] = source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		? [
			`${names.vFor}(`,
			...generateInterpolation(
				options,
				ctx,
				options.template,
				codeFeatures.all,
				source.content,
				source.loc.start.offset,
				`(`,
				`)`,
			),
			`!)`, // #3102
		]
		: [`{} as any`];
	// Evaluate the iterable before a loop binding can shadow its source.
	const sourceBindings = getConditionBindings(options.typescript, ctx, options.template, toString(sourceCodes));
	const sourceVar = bindingNames.some(name => sourceBindings.has(name)) ? ctx.getInternalVariable() : undefined;
	if (sourceVar) {
		yield `const ${sourceVar} = `;
		yield* sourceCodes;
		yield `;${newLine}`;
	}

	yield `for (const [`;
	if (leftExpressionRange && leftExpressionText) {
		ctx.declare(...bindingNames);
		yield [
			leftExpressionText,
			'template',
			leftExpressionRange.start,
			codeFeatures.all,
		];
	}
	yield `] of `;
	if (sourceVar) {
		yield sourceVar;
	}
	else {
		yield* sourceCodes;
	}
	yield `) {${newLine}`;

	const { inVFor } = ctx;
	ctx.inVFor = true;
	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child, false, true);
	}
	ctx.inVFor = inVFor;

	yield* endScope();
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

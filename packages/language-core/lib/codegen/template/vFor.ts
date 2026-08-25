import * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { getStartEnd } from '../../utils/shared';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { endOfLine, getTypeScriptAST, newLine } from '../utils';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation, shouldIdentifierSkipped } from './interpolation';
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
	let sourceAlias: string | undefined;
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
	if (
		source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		&& bindingNames.some(name =>
			options.setupBindings.has(name)
			|| options.setupRefs.has(name)
			|| options.importedComponents.has(name)
			|| shouldIdentifierSkipped(ctx, name)
		)
	) {
		// When a loop binding shadows a name that the source could resolve
		// lexically (setup binding, import, template-local, or global), evaluate
		// the source before the loop bindings' lexical scope is established, then
		// reference the alias in the head instead. This matches Vue's semantics,
		// where the source expression resolves in the parent scope.
		sourceAlias = ctx.getInternalVariable();
		yield `const ${sourceAlias} = `;
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
		yield endOfLine;
	}

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
	if (source.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		yield `${names.vFor}(`;
		if (sourceAlias !== undefined) {
			yield sourceAlias;
		}
		else {
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
		}
		yield `!)`; // #3102
	}
	else {
		yield `{} as any`;
	}
	yield `) {${newLine}`;

	// Declare after the source expression: in `v-for="x in x"`, the source
	// is evaluated in the outer scope where `x` is not yet shadowed.
	scope.declare(...bindingNames);

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

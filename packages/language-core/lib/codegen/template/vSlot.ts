import * as CompilerDOM from '@vue/compiler-dom';
import { replaceSourceRange } from 'muggle-string';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { Code } from '../../types';
import { collectBindingNames } from '../../utils/collectBindings';
import { completionFeatures, navigationFeatures, scriptFeatures, semanticFeatures } from '../features';
import { names } from '../names';
import { endOfLine, getTypeScriptAST, isTsLang, newLine } from '../utils';
import { Boundary, synthesizedIgnore } from '../utils/boundary';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';
import { generateTemplateChild } from './templateChild';

export function* generateVSlot(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	slotDir: CompilerDOM.DirectiveNode | undefined,
	ctxVar: string,
): Generator<Code> {
	const slotVar = ctx.getInternalVariable();
	if (slotDir) {
		yield `{${newLine}`;
		yield `const { `;
		if (slotDir.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && slotDir.arg.content) {
			yield* generateObjectProperty(
				options,
				ctx,
				slotDir.arg.loc.source,
				slotDir.arg.loc.start.offset,
				slotDir.arg.isStatic
					? { features: semanticFeatures | navigationFeatures | completionFeatures }
					: { features: scriptFeatures },
				false,
				true,
			);
		}
		else {
			const boundary = yield* Boundary.start(
				'template',
				slotDir.loc.start.offset,
				slotDir.loc.start.offset + (slotDir.rawName?.length ?? 0),
				{ features: semanticFeatures | navigationFeatures },
			);
			yield `default`;
			yield boundary.end();
		}
	}
	else {
		yield `const { `;
		// #932: reference for implicit default slot, anchored at the element's `<`
		// because a mapped range may not contain the element's other mappings
		const ignore = yield* Boundary.start('template', 0, 0, synthesizedIgnore);
		const boundary = yield* Boundary.start(
			'template',
			node.loc.start.offset,
			node.loc.start.offset + 1,
			{ features: navigationFeatures },
		);
		yield `default`;
		yield boundary.end();
		yield ignore.end();
	}
	yield `: ${slotVar} } = ${names.nonNull}(${ctxVar}.slots)${endOfLine}`;

	const scope = ctx.blockScope();
	if (slotDir?.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const slotAst = getTypeScriptAST(options.typescript, options.template, `(${slotDir.exp.content}) => {}`);
		yield* generateSlotParameters(options, ctx, slotAst, slotDir.exp, slotVar);
		scope.declare(...collectBindingNames(options.typescript, slotAst, slotAst));
	}
	yield* ctx.generateDiagnosticDirectiveEnd();
	for (const child of node.children) {
		yield* generateTemplateChild(options, ctx, child);
	}
	yield* scope.end();

	if (slotDir) {
		let isStatic = true;
		if (slotDir.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
			isStatic = slotDir.arg.isStatic;
		}
		yield `}${newLine}`;
		if (isStatic && !slotDir.arg) {
			if (slotDir.loc.source.startsWith('#') || slotDir.loc.source.startsWith('v-slot:')) {
				yield `/** @type {NonNullable<typeof ${ctxVar}['slots']>['`;
				yield [
					'',
					'template',
					slotDir.loc.start.offset + (
						slotDir.loc.source.startsWith('#')
							? '#'.length
							: 'v-slot:'.length
					),
					{ features: completionFeatures },
				];
				yield `']} */${endOfLine}`;
			}
		}
	}
}

function* generateSlotParameters(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	ast: ts.SourceFile,
	exp: CompilerDOM.SimpleExpressionNode,
	slotVar: string,
): Generator<Code> {
	const { typescript: ts } = options;
	const statement = ast.statements[0];
	if (!statement || !ts.isExpressionStatement(statement) || !ts.isArrowFunction(statement.expression)) {
		return;
	}

	const { expression } = statement;
	const startOffset = exp.loc.start.offset - 1;
	const types: (Code | null)[] = [];
	const interpolation = [...generateInterpolation(
		options,
		ctx,
		options.template,
		{ features: scriptFeatures },
		ast.text,
		startOffset,
	)];

	replaceSourceRange(interpolation, 'template', startOffset, startOffset + `(`.length);
	replaceSourceRange(
		interpolation,
		'template',
		startOffset + ast.text.length - `) => {}`.length,
		startOffset + ast.text.length,
	);

	for (const { name, type } of expression.parameters) {
		if (type) {
			types.push([
				ast.text.slice(name.end, type.end),
				'template',
				startOffset + name.end,
				{ features: scriptFeatures },
			]);
			replaceSourceRange(interpolation, 'template', startOffset + name.end, startOffset + type.end);
		}
		else {
			types.push(null);
		}
	}

	yield `const [`;
	yield* interpolation;
	yield `] = ${names.vSlot}(${names.nonNull}(${slotVar})`;

	if (types.some(t => t)) {
		yield `, `;
		const boundary = yield* Boundary.start(
			'template',
			exp.loc.start.offset,
			exp.loc.end.offset,
			{ features: 0 },
		);
		yield `(`;
		yield* types.flatMap(type => type ? [`_`, type, `, `] : `_, `);
		yield isTsLang(options.scriptLang) ? `) => [] as any` : `) => /** @type {any} */ ([])`;
		yield boundary.end();
	}
	yield `)${endOfLine}`;
}

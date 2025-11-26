import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript';
import type { Code, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { combineLastMapping, endOfLine, getTypeScriptAST, identifierRegex, newLine } from '../utils';
import { generateCamelized } from '../utils/camelized';
import { wrapWith } from '../utils/wrapWith';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generateElementEvents(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	componentOriginalVar: string,
): Generator<Code> {
	let emitsVar: string | undefined;

	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& (
				prop.name === 'on'
					&& (prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)
				|| options.vueCompilerOptions.strictVModel
					&& prop.name === 'model'
					&& (!prop.arg || prop.arg.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)
			)
		) {
			if (!emitsVar) {
				emitsVar = ctx.getInternalVariable();
				yield `let ${emitsVar}!: __VLS_ResolveEmits<typeof ${componentOriginalVar}, typeof ${
					ctx.currentComponent!.ctxVar
				}.emit>${endOfLine}`;
			}

			let source = prop.arg?.loc.source ?? 'model-value';
			let start = prop.arg?.loc.start.offset;
			let propPrefix = 'on-';
			let emitPrefix = '';
			if (prop.name === 'model') {
				propPrefix = 'onUpdate:';
				emitPrefix = 'update:';
			}
			else if (source.startsWith('vue:')) {
				source = source.slice('vue:'.length);
				start = start! + 'vue:'.length;
				propPrefix = 'onVnode-';
				emitPrefix = 'vnode-';
			}
			const propName = camelize(propPrefix + source);
			const emitName = emitPrefix + source;
			const camelizedEmitName = camelize(emitName);

			yield `const ${ctx.getInternalVariable()}: __VLS_NormalizeComponentEvent<typeof ${
				ctx.currentComponent!.propsVar
			}, typeof ${emitsVar}, '${propName}', '${emitName}', '${camelizedEmitName}'> = (${newLine}`;
			if (prop.name === 'on') {
				yield `{ `;
				yield* generateEventArg(options, source, start!, emitPrefix.slice(0, -1), codeFeatures.navigation);
				yield `: {} as any } as typeof ${emitsVar},${newLine}`;
			}
			yield `{ `;
			if (prop.name === 'on') {
				yield* generateEventArg(options, source, start!, propPrefix.slice(0, -1));
				yield `: `;
				yield* generateEventExpression(options, ctx, prop);
			}
			else {
				yield `'${propName}': `;
				yield* generateModelEventExpression(options, ctx, prop);
			}
			yield `})${endOfLine}`;
		}
	}
}

export function* generateEventArg(
	options: TemplateCodegenOptions,
	name: string,
	start: number,
	directive = 'on',
	features?: VueCodeInformation,
): Generator<Code> {
	features ??= {
		...codeFeatures.semanticWithoutHighlight,
		...codeFeatures.navigationWithoutRename,
		...options.vueCompilerOptions.checkUnknownEvents
			? codeFeatures.verification
			: codeFeatures.doNotReportTs2353AndTs2561,
	};

	if (directive.length) {
		name = capitalize(name);
	}
	if (identifierRegex.test(camelize(name))) {
		yield ['', 'template', start, features];
		yield directive;
		yield* generateCamelized(name, 'template', start, combineLastMapping);
	}
	else {
		yield* wrapWith(
			'template',
			start,
			start + name.length,
			features,
			`'`,
			directive,
			...generateCamelized(name, 'template', start, combineLastMapping),
			`'`,
		);
	}
}

export function* generateEventExpression(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
): Generator<Code> {
	if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const ast = getTypeScriptAST(options.ts, options.template, prop.exp.content);
		const isCompound = isCompoundExpression(options.ts, ast);
		const interpolation = generateInterpolation(
			options,
			ctx,
			options.template,
			codeFeatures.all,
			prop.exp.content,
			prop.exp.loc.start.offset,
			isCompound ? `` : `(`,
			isCompound ? `` : `)`,
		);

		if (isCompound) {
			yield `(...[$event]) => {${newLine}`;
			const scoped = ctx.scope();
			scoped.declare('$event');
			yield* ctx.generateConditionGuards();
			yield* interpolation;
			yield endOfLine;
			scoped.end();
			yield* ctx.generateAutoImportCompletion();
			yield `}`;

			ctx.inlayHints.push({
				blockName: 'template',
				offset: prop.exp.loc.start.offset,
				setting: 'vue.inlayHints.inlineHandlerLeading',
				label: '$event =>',
				paddingRight: true,
				tooltip: [
					'`$event` is a hidden parameter, you can use it in this callback.',
					'To hide this hint, set `vue.inlayHints.inlineHandlerLeading` to `false` in IDE settings.',
					'[More info](https://github.com/vuejs/language-tools/issues/2445#issuecomment-1444771420)',
				].join('\n\n'),
			});
		}
		else {
			yield* interpolation;
		}
	}
	else {
		yield `() => {}`;
	}
}

export function* generateModelEventExpression(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
): Generator<Code> {
	if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		yield `(...[$event]) => {${newLine}`;
		yield* ctx.generateConditionGuards();
		yield* generateInterpolation(
			options,
			ctx,
			options.template,
			codeFeatures.verification,
			prop.exp.content,
			prop.exp.loc.start.offset,
		);
		yield ` = $event${endOfLine}`;
		yield `}`;
	}
	else {
		yield `() => {}`;
	}
}

export function isCompoundExpression(ts: typeof import('typescript'), ast: ts.SourceFile) {
	let result = true;
	if (ast.statements.length === 0) {
		result = false;
	}
	else if (ast.statements.length === 1) {
		ts.forEachChild(ast, child_1 => {
			if (ts.isExpressionStatement(child_1)) {
				ts.forEachChild(child_1, child_2 => {
					if (ts.isArrowFunction(child_2)) {
						result = false;
					}
					else if (isPropertyAccessOrId(ts, child_2)) {
						result = false;
					}
				});
			}
			else if (ts.isFunctionDeclaration(child_1)) {
				result = false;
			}
		});
	}
	return result;
}

function isPropertyAccessOrId(ts: typeof import('typescript'), node: ts.Node) {
	if (ts.isIdentifier(node)) {
		return true;
	}
	if (ts.isPropertyAccessExpression(node)) {
		return isPropertyAccessOrId(ts, node.expression);
	}
	return false;
}

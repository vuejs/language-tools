import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript';
import type { Code, VueCodeInformation } from '../../types';
import { combineLastMapping, createTsAst, endOfLine, identifierRegex, newLine } from '../utils';
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
	componentFunctionalVar: string,
	componentVNodeVar: string,
	componentCtxVar: string
): Generator<Code> {
	let emitsVar: string | undefined;
	let propsVar: string | undefined;

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
			ctx.currentComponent!.used = true;
			if (!emitsVar) {
				emitsVar = ctx.getInternalVariable();
				propsVar = ctx.getInternalVariable();
				yield `let ${emitsVar}!: __VLS_ResolveEmits<typeof ${componentOriginalVar}, typeof ${componentCtxVar}.emit>${endOfLine}`;
				yield `let ${propsVar}!: __VLS_FunctionalComponentProps<typeof ${componentFunctionalVar}, typeof ${componentVNodeVar}>${endOfLine}`;
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

			yield `(): __VLS_NormalizeComponentEvent<typeof ${propsVar}, typeof ${emitsVar}, '${propName}', '${emitName}', '${camelizedEmitName}'> => (${newLine}`;
			if (prop.name === 'on') {
				yield `{ `;
				yield* generateEventArg(ctx, source, start!, emitPrefix.slice(0, -1), ctx.codeFeatures.navigation);
				yield `: {} as any } as typeof ${emitsVar},${newLine}`;
			}
			yield `{ `;
			if (prop.name === 'on') {
				yield* generateEventArg(ctx, source, start!, propPrefix.slice(0, -1));
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
	ctx: TemplateCodegenContext,
	name: string,
	start: number,
	directive = 'on',
	features: VueCodeInformation = {
		...ctx.codeFeatures.withoutHighlightAndCompletion,
		...ctx.codeFeatures.navigationWithoutRename,
	}
): Generator<Code> {
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
			start,
			start + name.length,
			features,
			`'`,
			directive,
			...generateCamelized(name, 'template', start, combineLastMapping),
			`'`
		);
	}
}

export function* generateEventExpression(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode
): Generator<Code> {
	if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		let prefix = `(`;
		let suffix = `)`;
		let isFirstMapping = true;

		const ast = createTsAst(options.ts, prop.exp, prop.exp.content);
		const _isCompoundExpression = isCompoundExpression(options.ts, ast);
		if (_isCompoundExpression) {
			yield `(...[$event]) => {${newLine}`;
			ctx.addLocalVariable('$event');
			yield* ctx.generateConditionGuards();
			prefix = ``;
			suffix = ``;
		}

		yield* generateInterpolation(
			options,
			ctx,
			'template',
			offset => {
				if (_isCompoundExpression && isFirstMapping) {
					isFirstMapping = false;
					ctx.inlayHints.push({
						blockName: 'template',
						offset,
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
				return ctx.codeFeatures.all;
			},
			prop.exp.content,
			prop.exp.loc.start.offset,
			prop.exp.loc,
			prefix,
			suffix
		);

		if (_isCompoundExpression) {
			ctx.removeLocalVariable('$event');

			yield endOfLine;
			yield `}`;
		}
	}
	else {
		yield `() => {}`;
	}
}

export function* generateModelEventExpression(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode
): Generator<Code> {
	if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		yield `(...[$event]) => {${newLine}`;
		yield* ctx.generateConditionGuards();
		yield* generateInterpolation(
			options,
			ctx,
			'template',
			ctx.codeFeatures.verification,
			prop.exp.content,
			prop.exp.loc.start.offset,
			prop.exp.loc
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
	} else if (ast.statements.length === 1) {
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

import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript';
import type { Code, VueCodeInformation } from '../../types';
import { hyphenateAttr } from '../../utils/shared';
import { combineLastMapping, createTsAst, endOfLine, newLine, variableNameRegex, wrapWith } from '../utils';
import { generateCamelized } from '../utils/camelized';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generateElementEvents(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	componentVar: string,
	componentInstanceVar: string,
	eventsVar: string
): Generator<Code, boolean> {
	let usedComponentEventsVar = false;
	let propsVar: string | undefined;
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'on'
			&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
			&& !prop.arg.loc.source.startsWith('[')
			&& !prop.arg.loc.source.endsWith(']')
		) {
			usedComponentEventsVar = true;
			if (!propsVar) {
				propsVar = ctx.getInternalVariable();
				yield `let ${propsVar}!: __VLS_FunctionalComponentProps<typeof ${componentVar}, typeof ${componentInstanceVar}>${endOfLine}`;
			}
			const isVNodeEvent = prop.arg.loc.source.startsWith('vue:');
			const name = isVNodeEvent
				? 'vnode-' + prop.arg.loc.source.slice('vue:'.length)
				: prop.arg.loc.source;
			const originalPropName = camelize('on-' + prop.arg.loc.source);
			yield `const ${ctx.getInternalVariable()}: __VLS_NormalizeComponentEvent<typeof ${propsVar}, typeof ${eventsVar}, '${originalPropName}', '${name}', '${camelize(name)}'> = {${newLine}`;
			yield* generateEventArg(ctx, prop.arg, name, isVNodeEvent);
			yield `: `;
			yield* generateEventExpression(options, ctx, prop);
			yield `}${endOfLine}`;
		}
	}
	return usedComponentEventsVar;
}

const eventArgFeatures: VueCodeInformation = {
	navigation: {
		// @click-outside -> onClickOutside
		resolveRenameNewName(newName) {
			return camelize('on-' + newName);
		},
		// onClickOutside -> @click-outside
		resolveRenameEditText(newName) {
			const hName = hyphenateAttr(newName);
			if (hyphenateAttr(newName).startsWith('on-')) {
				return camelize(hName.slice('on-'.length));
			}
			return newName;
		},
	},
};

export function* generateEventArg(
	ctx: TemplateCodegenContext,
	arg: CompilerDOM.SimpleExpressionNode,
	name: string = arg.loc.source,
	isVNodeEvent: boolean = false
): Generator<Code> {
	if (isVNodeEvent) {
		yield ['', 'template', arg.loc.start.offset, {
			...ctx.codeFeatures.withoutHighlightAndCompletion,
			...ctx.codeFeatures.navigationWithoutRename
		}];
		yield `onVnode`;
		yield* generateCamelized(
			capitalize(name.slice('vnode-'.length)),
			arg.loc.start.offset + 'vue:'.length,
			combineLastMapping
		);
		return;
	}

	const features = {
		...ctx.codeFeatures.withoutHighlightAndCompletion,
		...eventArgFeatures,
	};
	if (variableNameRegex.test(camelize(name))) {
		yield ['', 'template', arg.loc.start.offset, features];
		yield `on`;
		yield* generateCamelized(
			capitalize(name),
			arg.loc.start.offset,
			combineLastMapping
		);
	}
	else {
		yield* wrapWith(
			arg.loc.start.offset,
			arg.loc.end.offset,
			features,
			`'`,
			['', 'template', arg.loc.start.offset, combineLastMapping],
			'on',
			...generateCamelized(
				capitalize(name),
				arg.loc.start.offset,
				combineLastMapping
			),
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
		let prefix = '(';
		let suffix = ')';
		let isFirstMapping = true;

		const ast = createTsAst(options.ts, prop.exp, prop.exp.content);
		const _isCompoundExpression = isCompoundExpression(options.ts, ast);
		if (_isCompoundExpression) {
			yield `(...[$event]) => {${newLine}`;
			ctx.addLocalVariable('$event');

			prefix = '';
			suffix = '';
			for (const blockCondition of ctx.blockConditions) {
				prefix += `if (!(${blockCondition})) return${endOfLine}`;
			}
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
			yield* ctx.generateAutoImportCompletion();
			yield `}`;
		}
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

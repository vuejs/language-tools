import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript';
import type { Code, VueCodeInformation } from '../../types';
import { hyphenateAttr } from '../../utils/shared';
import { combineLastMapping, createTsAst, endOfLine, newLine, variableNameRegex, wrapWith } from '../common';
import { generateCamelized } from './camelized';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';
import { generateObjectProperty } from './objectProperty';

export function* generateElementEvents(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	componentVar: string,
	componentInstanceVar: string,
	eventsVar: string,
	used: () => void,
): Generator<Code> {
	for (const prop of node.props) {
		if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'on'
			&& prop.arg?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			used();
			const eventVar = ctx.getInternalVariable();
			yield `let ${eventVar} = { '${prop.arg.loc.source}': __VLS_pickEvent(`;
			yield `${eventsVar}['${prop.arg.loc.source}'], `;
			yield `({} as __VLS_FunctionalComponentProps<typeof ${componentVar}, typeof ${componentInstanceVar}>)`;
			yield* generateEventArg(options, ctx, prop.arg, true);
			yield `) }${endOfLine}`;
			yield `${eventVar} = { `;
			if (prop.arg.loc.source.startsWith('[') && prop.arg.loc.source.endsWith(']')) {
				yield `[(`;
				yield* generateInterpolation(
					options,
					ctx,
					prop.arg.loc.source.slice(1, -1),
					prop.arg.loc,
					prop.arg.loc.start.offset + 1,
					ctx.codeFeatures.all,
					'',
					'',
				);
				yield `)!]`;
			}
			else {
				yield* generateObjectProperty(
					options,
					ctx,
					prop.arg.loc.source,
					prop.arg.loc.start.offset,
					ctx.codeFeatures.withoutHighlightAndCompletionAndNavigation,
					prop.arg.loc
				);
			}
			yield `: `;
			yield* generateEventExpression(options, ctx, prop);
			yield ` }${endOfLine}`;
		}
		else if (
			prop.type === CompilerDOM.NodeTypes.DIRECTIVE
			&& prop.name === 'on'
			&& prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
		) {
			// for vue 2 nameless event
			// https://github.com/johnsoncodehk/vue-tsc/issues/67
			yield* generateInterpolation(
				options,
				ctx,
				prop.exp.content,
				prop.exp.loc,
				prop.exp.loc.start.offset,
				ctx.codeFeatures.all,
				'$event => {(',
				')}',
			);
			yield endOfLine;
		}
	}
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
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	arg: CompilerDOM.SimpleExpressionNode,
	access: boolean,
): Generator<Code> {
	if (arg.loc.source.startsWith('[') && arg.loc.source.endsWith(']')) {
		yield `[`;
		yield* generateInterpolation(
			options,
			ctx,
			arg.loc.source.slice(1, -1),
			arg.loc,
			arg.loc.start.offset + 1,
			ctx.codeFeatures.all,
			'',
			'',
		);
		yield `]`;
	}
	else if (variableNameRegex.test(camelize(arg.loc.source))) {
		if (access) {
			yield `.`;
		}
		yield ['', 'template', arg.loc.start.offset, eventArgFeatures];
		yield `on`;
		yield* generateCamelized(
			capitalize(arg.loc.source),
			arg.loc.start.offset,
			combineLastMapping,
		);
	}
	else {
		if (access) {
			yield `[`;
		}
		yield* wrapWith(
			arg.loc.start.offset,
			arg.loc.end.offset,
			eventArgFeatures,
			`'`,
			['', 'template', arg.loc.start.offset, combineLastMapping],
			'on',
			...generateCamelized(
				capitalize(arg.loc.source),
				arg.loc.start.offset,
				combineLastMapping,
			),
			`'`,
		);
		if (access) {
			yield `]`;
		}
	}
}

export function* generateEventExpression(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
): Generator<Code> {
	if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		let prefix = '(';
		let suffix = ')';
		let isFirstMapping = true;

		const ast = createTsAst(options.ts, prop.exp, prop.exp.content);
		const _isCompoundExpression = isCompoundExpression(options.ts, ast);
		if (_isCompoundExpression) {

			yield `$event => {${newLine}`;
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
			prop.exp.content,
			prop.exp.loc,
			prop.exp.loc.start.offset,
			() => {
				if (_isCompoundExpression && isFirstMapping) {
					isFirstMapping = false;
					return {
						...ctx.codeFeatures.all,
						__hint: {
							setting: 'vue.inlayHints.inlineHandlerLeading',
							label: '$event =>',
							tooltip: [
								'`$event` is a hidden parameter, you can use it in this callback.',
								'To hide this hint, set `vue.inlayHints.inlineHandlerLeading` to `false` in IDE settings.',
								'[More info](https://github.com/vuejs/language-tools/issues/2445#issuecomment-1444771420)',
							].join('\n\n'),
							paddingRight: true,
						},
					};
				}
				return ctx.codeFeatures.all;
			},
			prefix,
			suffix,
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
	if (ast.statements.length === 1) {
		ts.forEachChild(ast, child_1 => {
			if (ts.isExpressionStatement(child_1)) {
				ts.forEachChild(child_1, child_2 => {
					if (ts.isArrowFunction(child_2)) {
						result = false;
					}
					else if (ts.isIdentifier(child_2)) {
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

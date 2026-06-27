import * as CompilerDOM from '@vue/compiler-dom';
import { camelize, capitalize } from '@vue/shared';
import type * as ts from 'typescript';
import { getUnwrappedExpression } from '../../parsers/utils';
import type { Code, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { endOfLine, getTypeScriptAST, identifierRegex, newLine } from '../utils';
import { Boundary } from '../utils/boundary';
import { generateCamelized } from '../utils/camelized';
import type { TemplateCodegenContext } from './context';
import type { TemplateCodegenOptions } from './index';
import { generateInterpolation } from './interpolation';

export function* generateElementEvents(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	node: CompilerDOM.ElementNode,
	componentOriginalVar: string,
	getCtxVar: () => string,
	getPropsVar: () => string,
): Generator<Code> {
	const definitions: Record<string, {
		propPrefix: string;
		emitPrefix: string;
		propName: string;
		emitName: string;
		items: {
			prop: CompilerDOM.DirectiveNode;
			source: string;
			offset: number | undefined;
		}[];
	}> = {};

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
			let source = prop.arg?.loc.source ?? 'model-value';
			let offset = prop.arg?.loc.start.offset;
			let propPrefix = 'on-';
			let emitPrefix = '';
			if (prop.name === 'model') {
				propPrefix = 'onUpdate:';
				emitPrefix = 'update:';
			}
			else if (source.startsWith('vue:')) {
				source = source.slice('vue:'.length);
				offset = offset! + 'vue:'.length;
				propPrefix = 'onVnode-';
				emitPrefix = 'vnode-';
			}
			const propName = camelize(propPrefix + source);
			const emitName = emitPrefix + source;
			const key = [
				prop.name,
				propName,
				...prop.modifiers.map(modifier => modifier.content),
			].join('+');

			definitions[key] ??= {
				propPrefix,
				emitPrefix,
				propName,
				emitName,
				items: [],
			};
			definitions[key].items.push({
				prop,
				source,
				offset,
			});
		}
	}

	if (!Object.keys(definitions).length) {
		return;
	}

	const emitsVar = ctx.getInternalVariable();
	yield `let ${emitsVar}!: ${names.ResolveEmits}<typeof ${componentOriginalVar}, typeof ${getCtxVar()}.emit>${endOfLine}`;

	for (const { propPrefix, emitPrefix, propName, emitName, items } of Object.values(definitions)) {
		yield `const ${ctx.getInternalVariable()}: ${names.ResolveEvent}<typeof ${getPropsVar()}, typeof ${emitsVar}, '${propName}', '${emitName}', '${
			camelize(emitName)
		}'> = {${newLine}`;
		for (const { prop, source, offset } of items) {
			if (prop.name === 'on') {
				yield `/** @type {typeof ${emitsVar}.`;
				yield* generateEventArg(options, source, offset!, emitPrefix.slice(0, -1), codeFeatures.navigation);
				yield `} */${newLine}`;
			}
			if (prop.name === 'on') {
				yield* generateEventArg(options, source, offset!, propPrefix.slice(0, -1));
				yield `: `;
				yield* generateEventExpression(options, ctx, prop);
			}
			else {
				yield `'${propName}': `;
				yield* generateModelEventExpression(options, ctx, prop);
			}
			yield `,${newLine}`;
		}
		yield `}${endOfLine}`;
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
		const boundary = yield* Boundary.start('template', start, features);
		yield directive;
		yield* generateCamelized(name, 'template', start, boundary.features);
	}
	else {
		const boundary = yield* Boundary.start('template', start, features);
		yield `'`;
		yield directive;
		yield* generateCamelized(name, 'template', start, boundary.features);
		yield `'`;
		yield boundary.end(start + name.length);
	}
}

export function* generateEventExpression(
	options: TemplateCodegenOptions,
	ctx: TemplateCodegenContext,
	prop: CompilerDOM.DirectiveNode,
): Generator<Code> {
	if (prop.exp?.type === CompilerDOM.NodeTypes.SIMPLE_EXPRESSION) {
		const ast = getTypeScriptAST(options.typescript, options.template, prop.exp.content);
		const isCompound = isCompoundExpression(options.typescript, ast);
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
			const scope = ctx.scope();
			scope.declare('$event');
			yield* ctx.generateConditionGuards();
			if (isSingleExpression(options.typescript, ast)) {
				yield `return `;
			}
			yield* interpolation;
			yield endOfLine;
			yield* scope.end();
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
	if (ast.statements.length === 0) {
		return false;
	}
	if (ast.statements.length === 1 && ast.text[ast.endOfFileToken.pos - 1] !== ';') {
		const statement = ast.statements[0]!;
		if (ts.isExpressionStatement(statement)) {
			const node = getUnwrappedExpression(ts, statement.expression);
			if (
				ts.isArrowFunction(node)
				|| ts.isIdentifier(node)
				|| ts.isElementAccessExpression(node)
				|| ts.isPropertyAccessExpression(node)
			) {
				return false;
			}
		}
		else if (ts.isFunctionDeclaration(statement)) {
			return false;
		}
	}
	return true;
}

function isSingleExpression(ts: typeof import('typescript'), ast: ts.SourceFile) {
	if (ast.statements.length === 1 && ast.text[ast.endOfFileToken.pos - 1] !== ';') {
		const statement = ast.statements[0]!;
		if (ts.isExpressionStatement(statement)) {
			return true;
		}
	}
	return false;
}

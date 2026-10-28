import {
	getDefineModelPropName,
	getNodeText,
	type TypeScript as CoreTypeScript,
	type VueSource,
} from '@vue/language-core';
import type { Expression, Node, ObjectLiteralExpression } from 'typescript/ast' with {
	'resolution-mode': 'import',
};

/** The defaults that the `<script setup>` of a Vue file gives its props, by prop name. */
export function getDefaultsFromScriptSetup(ts: CoreTypeScript, { ir, analysis }: VueSource) {
	const result = new Map<string, string>();
	const { scriptSetup } = ir;
	const ranges = analysis.getScriptSetupRanges();
	if (!scriptSetup || !ranges) {
		return result;
	}
	const { ast } = scriptSetup;
	const { defineProps, withDefaults, defineModel } = ranges;
	const add = (name: string, expression: Node) => result.set(name, getNodeText(expression, ast));
	// a quoted name gives the prop name without its quotes
	const getNameText = (name: Node) =>
		ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : getNodeText(name, ast);

	// `const { foo = 1 } = defineProps()`
	const propsCall = defineProps && (withDefaults?.callExp ?? defineProps.callExp);
	if (propsCall) {
		ast.forEachChild(function visit(node) {
			if (
				ts.isVariableDeclaration(node)
				&& ts.isObjectBindingPattern(node.name)
				&& node.initializer
				&& node.initializer.getStart(ast) === propsCall.start
				&& node.initializer.end === propsCall.end
			) {
				for (const { propertyName, name, initializer } of node.name.elements) {
					const key = propertyName ?? name;
					if (key && initializer) {
						add(getNameText(key), initializer);
					}
				}
			}
			node.forEachChild(visit);
		});
	}

	for (const model of defineModel) {
		if (model.defaultValue) {
			add(
				getDefineModelPropName(scriptSetup, model),
				resolveDefaultOptionExpression(ts, model.defaultValue.node as Expression),
			);
		}
	}

	if (defineProps?.typeArg && withDefaults?.arg) {
		for (const prop of findObjectLiteralExpression(ts, withDefaults.arg.node)?.properties ?? []) {
			if (ts.isPropertyAssignment(prop)) {
				add(getNameText(prop.name), resolveDefaultOptionExpression(ts, prop.initializer));
			}
		}
	}

	return result;
}

function findObjectLiteralExpression(ts: CoreTypeScript, node: Node): ObjectLiteralExpression | undefined {
	if (ts.isObjectLiteralExpression(node)) {
		return node;
	}
	return node.forEachChild(child => findObjectLiteralExpression(ts, child));
}

/**
 * The value that a default option gives: what an arrow function returns when its body is that expression or a block of
 * a single `return` of it, otherwise the option as written.
 */
export function resolveDefaultOptionExpression(
	ts: Pick<CoreTypeScript, 'isArrowFunction' | 'isBlock' | 'isParenthesizedExpression' | 'isReturnStatement'>,
	_default: Expression,
): Node {
	if (ts.isArrowFunction(_default)) {
		if (ts.isBlock(_default.body)) {
			const [statement, ...rest] = _default.body.statements;
			return statement && !rest.length && ts.isReturnStatement(statement) && statement.expression
				? statement.expression
				: _default;
		}
		else if (ts.isParenthesizedExpression(_default.body)) {
			return _default.body.expression;
		}
		else {
			return _default.body;
		}
	}
	return _default;
}

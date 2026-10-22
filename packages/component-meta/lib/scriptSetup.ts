import { names } from '@vue/language-core';
import type { Expression, Node, ObjectLiteralExpression, SourceFile } from 'typescript-7/ast' with {
	'resolution-mode': 'import',
};
import type { TypeScript } from './types';

export async function getDefaultsFromScriptSetup(
	ts: TypeScript,
	print: (node: Node) => Promise<string>,
	sourceFile: SourceFile,
) {
	const result = new Map<string, string>();
	if (!sourceFile.contentMapper) {
		return result;
	}

	const pending: [string, Promise<string>][] = [];

	visit(sourceFile);

	for (const [name, text] of pending) {
		result.set(name, await text);
	}
	return result;

	function visit(node: Node) {
		if (ts.isVariableDeclaration(node) && node.initializer) {
			const name = node.name.getText();
			if (name === names.defaults) {
				const obj = findObjectLiteralExpression(ts, node.initializer);
				for (const prop of obj?.properties ?? []) {
					if (ts.isPropertyAssignment(prop)) {
						add(prop.name.getText(), resolveDefaultOptionExpression(ts, prop.initializer));
					}
				}
			}
			else if (name === names.defaultModels && ts.isObjectLiteralExpression(node.initializer)) {
				for (const prop of node.initializer.properties) {
					if (ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.name)) {
						add(prop.name.text, resolveDefaultOptionExpression(ts, prop.initializer));
					}
				}
			}
			else if (
				ts.isObjectBindingPattern(node.name)
				&& ts.isIdentifier(node.initializer)
				&& node.initializer.text === names.props
			) {
				for (const { propertyName, name, initializer } of node.name.elements) {
					const key = propertyName ?? name;
					if (key && initializer) {
						add(key.getText(), initializer);
					}
				}
			}
		}
		node.forEachChild(visit);
	}

	function add(name: string, expression: Node) {
		pending.push([name, print(expression)]);
	}
}

function findObjectLiteralExpression(ts: TypeScript, node: Node): ObjectLiteralExpression | undefined {
	if (ts.isObjectLiteralExpression(node)) {
		return node;
	}
	return node.forEachChild(child => findObjectLiteralExpression(ts, child));
}

export function resolveDefaultOptionExpression(ts: TypeScript, _default: Expression): Node {
	if (ts.isArrowFunction(_default)) {
		if (ts.isBlock(_default.body)) {
			return _default; // TODO
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

import { names } from '@vue/content-mapper/lib/codegen/names';
import type { Expression, Node, ObjectLiteralExpression, SourceFile } from 'typescript/ast' with {
	'resolution-mode': 'import',
};
import type { TypeScript } from './types';

export function getDefaultsFromScriptSetup(ts: TypeScript, sourceFile: SourceFile) {
	const result = new Map<string, string>();
	if (!sourceFile.contentMapper) {
		return result;
	}
	visit(sourceFile);
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
		result.set(name, expression.getText(sourceFile));
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

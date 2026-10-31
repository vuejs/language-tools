import type { Expression, Node } from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { TypeScript } from './types';

/**
 * The value that a default option gives: what an arrow function returns when its body is that expression or a block of
 * a single `return` of it, otherwise the option as written.
 */
export function resolveDefaultOptionExpression(
	ts: Pick<TypeScript, 'isArrowFunction' | 'isBlock' | 'isParenthesizedExpression' | 'isReturnStatement'>,
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

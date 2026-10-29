import { defineRule, type RuleContext } from '@tsslint/config';

type Node = Parameters<RuleContext['typescript']['isCallExpression']>[0];
type Type = Parameters<RuleContext['checker']['typeToString']>[0];

export default defineRule(({ typescript: ts, file, checker, report }) => {
	file.forEachChild(function visit(node): void {
		if (ts.isExpressionStatement(node)) {
			checkDiscarded(node.expression);
		}
		node.forEachChild(visit);
	});

	function checkDiscarded(node: Node): void {
		if (ts.isParenthesizedExpression(node) || ts.isVoidExpression(node)) {
			checkDiscarded(node.expression);
		}
		else if (ts.isBinaryExpression(node)) {
			const operator = node.operatorToken.kind;
			if (operator === ts.SyntaxKind.CommaToken) {
				checkDiscarded(node.left);
				checkDiscarded(node.right);
			}
			else if (
				operator === ts.SyntaxKind.AmpersandAmpersandToken
				|| operator === ts.SyntaxKind.BarBarToken
				|| operator === ts.SyntaxKind.QuestionQuestionToken
			) {
				checkDiscarded(node.right);
			}
		}
		else if (ts.isConditionalExpression(node)) {
			checkDiscarded(node.whenTrue);
			checkDiscarded(node.whenFalse);
		}
		else if (ts.isCallExpression(node) && isGenerator(checker.getTypeAtLocation(node))) {
			report(
				'A generator does nothing until it is iterated; use `yield*`, spread or `for...of` on it.',
				node.getStart(file),
				node.getEnd(),
			);
		}
	}

	function isGenerator(type: Type): boolean {
		if (type.isUnionType()) {
			return type.getTypes().some(isGenerator);
		}
		const name = type.getSymbol()?.name;
		return name === 'Generator' || name === 'AsyncGenerator';
	}
});

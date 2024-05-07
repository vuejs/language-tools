import type * as ts from 'typescript';

/**
 * Provide missing functions in tsc context.
 */
export function createTscApiShim(ts: typeof import('typescript')) {
	function isAsExpression(node: ts.Node): node is ts.AsExpression {
		return node.kind === ts.SyntaxKind.AsExpression;
	}
	function isTypeAssertionExpression(node: ts.Node): node is ts.TypeAssertion {
		return node.kind === ts.SyntaxKind.TypeAssertionExpression;
	}
	function isTemplateExpression(node: ts.Node): node is ts.TemplateExpression {
		return node.kind === ts.SyntaxKind.TemplateExpression;
	}

	return {
		isAsExpression,
		isTypeAssertionExpression,
		isTemplateExpression,
	};
};
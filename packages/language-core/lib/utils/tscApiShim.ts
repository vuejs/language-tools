import type * as ts from 'typescript';

/**
 * Provide missing functions in tsc context.
 */
export function injectTscApiShim(ts: typeof import('typescript')) {
	function isAsExpression(node: ts.Node): node is ts.AsExpression {
		return node.kind === ts.SyntaxKind.AsExpression;
	}
	function isTypeAssertionExpression(node: ts.Node): node is ts.TypeAssertion {
		return node.kind === ts.SyntaxKind.TypeAssertionExpression;
	}
	function isTemplateExpression(node: ts.Node): node is ts.TemplateExpression {
		return node.kind === ts.SyntaxKind.TemplateExpression;
	}

	return new Proxy(ts, {
		get(target, key) {
			if (key === 'isAsExpression') {
				return isAsExpression;
			}
			else if (key === 'isTypeAssertionExpression') {
				return isTypeAssertionExpression;
			}
			else if (key === 'isTemplateExpression') {
				return isTemplateExpression;
			}

			return target[key as keyof typeof target];
		}
	});
};

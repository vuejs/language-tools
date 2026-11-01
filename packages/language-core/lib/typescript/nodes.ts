import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { TextRange, TypeScript } from '../types';

export function getStartEnd<T extends ts.Node>(
	node: T,
	ast: ts.SourceFile,
): TextRange<T> {
	return {
		node,
		start: node.getStart(ast),
		end: node.end,
	};
}

export function getNodeText(
	node: ts.Node,
	ast: ts.SourceFile,
) {
	const { start, end } = getStartEnd(node, ast);
	return ast.text.slice(start, end);
}

// The type guards below are missing in the TypeScript 7 AST API.

export function isStringLiteralLike(
	ts: TypeScript,
	node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
	return node.kind === ts.SyntaxKind.StringLiteral || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral;
}

/** A function declaration or expression, a signature or a function type. */
export function isFunctionLike(ts: TypeScript, node: ts.Node): node is ts.SignatureDeclaration {
	switch (node.kind) {
		case ts.SyntaxKind.MethodSignature:
		case ts.SyntaxKind.CallSignature:
		case ts.SyntaxKind.ConstructSignature:
		case ts.SyntaxKind.IndexSignature:
		case ts.SyntaxKind.FunctionType:
		case ts.SyntaxKind.ConstructorType:
			return true;
	}
	return ts.isFunctionLikeDeclaration(node);
}

import { expect, test } from 'vitest';
import { isFunctionLike } from '../lib/typescript/nodes';
import { ts } from './typescript';

test('isFunctionLike covers the function declarations and expressions, signatures and function types', () => {
	const sourceFile = ts.createSourceFile(
		'/a.ts',
		`function a(p: number) { const o = { p }; return o; }
class C { constructor() {} m() {} get g() { return 1; } set s(v: number) {} }
const f = function() {};
const g = () => {};
interface I { m(): void; (): void; new(): I; [k: string]: unknown }
type F = () => void;
type N = new() => void;`,
		ts.ScriptTarget.Latest,
	);
	const kinds = new Set<number>();
	sourceFile.forEachChild(function visit(node): void {
		if (isFunctionLike(ts, node)) {
			kinds.add(node.kind);
		}
		node.forEachChild(visit);
	});
	expect(kinds).toEqual(
		new Set([
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.Constructor,
			ts.SyntaxKind.MethodDeclaration,
			ts.SyntaxKind.GetAccessor,
			ts.SyntaxKind.SetAccessor,
			ts.SyntaxKind.FunctionExpression,
			ts.SyntaxKind.ArrowFunction,
			ts.SyntaxKind.MethodSignature,
			ts.SyntaxKind.CallSignature,
			ts.SyntaxKind.ConstructSignature,
			ts.SyntaxKind.IndexSignature,
			ts.SyntaxKind.FunctionType,
			ts.SyntaxKind.ConstructorType,
		]),
	);
});

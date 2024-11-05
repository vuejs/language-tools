import * as ts from 'typescript';
import type { Sfc, VueCompilerOptions } from '../types';

const syntaxReg = /^\/\*\*\s*@vue\$(?<key>.+) (?<value>.+)\s*\*\/$/;

export function parseVueCompilerOptions(
	ts: typeof import('typescript'),
	sfc: Sfc
): Partial<VueCompilerOptions> | undefined {
	const entries = [
		...getLeadingComments(sfc.script?.ast),
		...getLeadingComments(sfc.scriptSetup?.ast)
	]

	if (entries.length) {
		return Object.fromEntries(entries);
	}

	return Object.fromEntries([
		...getLeadingComments(sfc.script?.ast),
		...getLeadingComments(sfc.scriptSetup?.ast),
	]);

	function getLeadingComments(ast: ts.SourceFile | undefined) {
		if (!ast) {
			return [];
		}
		const ranges = ts.getLeadingCommentRanges(ast.text, 0) ?? [];
		return ranges
			.filter(range => range.kind === 3 satisfies ts.SyntaxKind.MultiLineCommentTrivia)
			.map(range => {
				try {
					const text = ast.text.slice(range.pos, range.end)
					const match = text.match(syntaxReg);
					if (match) {
						const { key, value } = match.groups ?? {};
						return [key, JSON.parse(value)] as const;
					}
				}
				catch { };
			})
			.filter(item => !!item);
	}	
}

import type * as ts from 'typescript';

/**
 * The infer-only `new Component({...})` call is joined onto one line so a
 * single `// @ts-ignore` covers it. A `//` comment inside a multi-line prop
 * would then swallow the rest of that line, including the closing `}))`.
 * Turn those comments into block comments before flattening.
 */
export function flattenInferOnlyProps(ts: typeof import('typescript'), code: string): string {
	const scanner = ts.createScanner(99 satisfies ts.ScriptTarget.ESNext, false);
	scanner.setText(code);
	let out = '';
	while (true) {
		const kind = scanner.scan();
		if (kind === ts.SyntaxKind.EndOfFileToken) {
			break;
		}
		const text = scanner.getTokenText();
		if (kind === ts.SyntaxKind.SingleLineCommentTrivia) {
			out += `/*${text.slice(2)} */`;
		}
		else {
			out += text;
		}
	}
	return out.replace(/\n/g, ' ');
}

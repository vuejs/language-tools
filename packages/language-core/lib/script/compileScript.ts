import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { TypeScript } from '../types';

const scriptLangs = new Set(['js', 'ts', 'jsx', 'tsx']);

/** The AST of a script block, if TypeScript parses its `lang`. */
export function compileScript(ts: TypeScript, lang: string, script: string) {
	if (scriptLangs.has(lang)) {
		return ts.createSourceFile('.' + lang, script, 99 satisfies ts.ScriptTarget.Latest);
	}
}

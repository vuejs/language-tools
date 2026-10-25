import type { TypeScript } from './types';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { API } from 'typescript/sync' with { 'resolution-mode': 'import' };

let loaded: TypeScript | undefined;

/**
 * TypeScript 7 has no parser in the AST package, so source files are parsed by a TypeScript API
 * process, started on the first parse.
 */
export function loadTypeScript(): TypeScript {
	if (loaded) {
		return loaded;
	}
	const ast: typeof import('typescript/ast', { with: { 'resolution-mode': 'import' }}) = require('typescript/ast');
	let api: API | undefined;
	return loaded = {
		...ast,
		createSourceFile(fileName, sourceText, _languageVersion, _setParentNodes, scriptKind) {
			if (!api) {
				const { API }: typeof import('typescript/sync', { with: { 'resolution-mode': 'import' }}) = require(
					'typescript/sync',
				);
				api = new API();
			}
			const retained = api.createSourceFile(fileName, sourceText, { scriptKind });
			retained.dispose();
			const sourceFile = retained.sourceFile;
			// The API returns no parse diagnostics. language-core only reads them for code cut off at the
			// end, so they are approximated by the erroneous nodes that reach the end of the code.
			let parseDiagnostics: { start: number; length: number }[] | undefined;
			Object.defineProperty(sourceFile, 'parseDiagnostics', {
				get: () => parseDiagnostics ??= collectTruncationErrors(sourceFile, sourceText.trimEnd().length),
			});
			return sourceFile;

			function collectTruncationErrors(
				node: ts.Node,
				textEnd: number,
				errors: { start: number; length: number }[] = [],
			) {
				if (node.end < textEnd) {
					return errors;
				}
				if (node.flags & ast.NodeFlags.ThisNodeHasError) {
					errors.push({ start: node.end, length: 0 });
				}
				node.forEachChild(child => {
					collectTruncationErrors(child, textEnd, errors);
				});
				return errors;
			}
		},
	};
}

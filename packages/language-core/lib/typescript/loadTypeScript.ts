import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { API } from 'typescript/sync' with { 'resolution-mode': 'import' };
import type { TypeScript } from '../types';

const loaded = new Map<string | undefined, TypeScript>();

/**
 * Resolves `subpath` of the TS 7.1 package whose `package.json` is `packageJsonPath`, under the name that the
 * package gives itself, so that the API of an installation is always that installation's.
 */
export function resolveTypeScriptModule(packageJsonPath: string, subpath: 'ast' | 'sync' | 'async') {
	const manifestPath = fs.realpathSync(packageJsonPath);
	const { name } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	return createRequire(manifestPath).resolve(`${name}/${subpath}`);
}

/** The `package.json` of the `typescript` package that resolves from `directory`, which must be TS 7.1. */
export function resolveTypeScriptPackageJson(directory: string) {
	const { resolve } = createRequire(path.join(directory, 'package.json'));
	try {
		resolve('typescript/ast');
		return resolve('typescript/package.json');
	}
	catch {
		throw new Error(
			`Cannot find TS 7.1 from ${directory}: no \`typescript\` package with \`typescript/ast\` resolves from it.`,
		);
	}
}

/**
 * TypeScript 7 has no parser in the AST package, so source files are parsed by a TypeScript API
 * process, started on the first parse. Without `packageJsonPath`, the `typescript` package that
 * resolves from here provides them.
 */
export function loadTypeScript(packageJsonPath?: string): TypeScript {
	const cached = loaded.get(packageJsonPath);
	if (cached) {
		return cached;
	}
	const ast: typeof import('typescript/ast', { with: { 'resolution-mode': 'import' }}) = packageJsonPath
		? require(resolveTypeScriptModule(packageJsonPath, 'ast'))
		: require('typescript/ast');
	let api: API | undefined;
	const typescript: TypeScript = {
		...ast,
		createSourceFile(fileName, sourceText, _languageVersion, _setParentNodes, scriptKind) {
			if (!api) {
				const { API }: typeof import('typescript/sync', { with: { 'resolution-mode': 'import' }}) = packageJsonPath
					? require(resolveTypeScriptModule(packageJsonPath, 'sync'))
					: require('typescript/sync');
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
	loaded.set(packageJsonPath, typescript);
	return typescript;
}

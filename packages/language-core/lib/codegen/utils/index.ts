import type * as ts from 'typescript';
import type { Code, IRBlock, IRScript, IRScriptSetup, VueCodeInformation, VueCompilerOptions } from '../../types';
import { codeFeatures } from '../codeFeatures';

export const newLine = `\n`;
export const endOfLine = `;${newLine}`;
export const identifierRE = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

export function isTsLang(lang: string): boolean {
	return lang === 'ts' || lang === 'tsx';
}

// `{} as T` in TS; `/** @type {T} */ ({})` in JS. The JSDoc cast keeps the
// same assertion semantics under checkJs, and requires no type-only syntax.
export function asType(type: string, lang: string): string {
	return isTsLang(lang) ? `{} as ${type}` : `/** @type {${type}} */ ({})`;
}

// `let name!: T;` in TS; `var name = /** @type {T} */ ({});` in JS.
export function* generateTypedVar(
	kind: 'let' | 'var',
	name: string,
	lang: string,
	type: () => Generator<Code>,
): Generator<Code> {
	if (isTsLang(lang)) {
		yield `${kind} ${name}!: `;
		yield* type();
		yield endOfLine;
	}
	else {
		yield `var ${name} = /** @type {`;
		yield* type();
		yield `} */ ({})${endOfLine}`;
	}
}

// `type name = T;` in TS; `/** @typedef {T} name */` in JS.
export function* generateTypeAlias(
	name: string,
	lang: string,
	type: () => Generator<Code>,
): Generator<Code> {
	if (isTsLang(lang)) {
		yield `type ${name} = `;
		yield* type();
		yield endOfLine;
	}
	else {
		yield `/** @typedef {`;
		yield* type();
		yield `} ${name} */${newLine}`;
	}
}

// The phantom argument that carries the component library's `Ref` brand into
// `__VLS_unwrap` / `__VLS_withDotValue`; the helper declarations cannot
// resolve the library import themselves.
export function getRefBrandArgument(vueCompilerOptions: VueCompilerOptions, lang: string): string {
	return asType(`import('${vueCompilerOptions.lib}').Ref<unknown>`, lang);
}

const cacheMaps = new WeakMap<IRBlock, [content: string, Map<string, [ts.SourceFile, usages: number]>]>();

export function getTypeScriptAST(ts: typeof import('typescript'), block: IRBlock, text: string): ts.SourceFile {
	if (!cacheMaps.has(block)) {
		cacheMaps.set(block, [block.content, new Map()]);
	}
	const cacheMap = cacheMaps.get(block)!;
	if (cacheMap[0] !== block.content) {
		cacheMap[0] = block.content;
		for (const [key, info] of cacheMap[1]) {
			if (info[1]) {
				info[1] = 0;
			}
			else {
				cacheMap[1].delete(key);
			}
		}
	}
	const cache = cacheMap[1].get(text);
	if (cache) {
		cache[1]++;
		return cache[0];
	}
	const ast = ts.createSourceFile('/dummy.ts', text, 99 satisfies ts.ScriptTarget.ESNext);
	cacheMap[1].set(text, [ast, 1]);
	return ast;
}

export function* generateSfcBlockSection(
	block: IRScript | IRScriptSetup,
	start: number,
	end: number,
	features: VueCodeInformation,
): Generator<Code> {
	const text = block.content.slice(start, end);
	yield [text, block.name, start, features];

	// #3632
	if ('parseDiagnostics' in block.ast) {
		const textEnd = text.trimEnd().length;
		for (const diag of block.ast.parseDiagnostics as ts.DiagnosticWithLocation[]) {
			const diagStart = diag.start;
			const diagEnd = diag.start + diag.length;
			if (diagStart >= textEnd && diagEnd <= end) {
				// map the synthesized terminator to the end of the section, so that
				// truncation parse errors resolve back to the original block
				yield [';', block.name, end, codeFeatures.verification];
				yield newLine;
				break;
			}
		}
	}
}

export function* forEachNode(ts: typeof import('typescript'), node: ts.Node): Generator<ts.Node> {
	const children: ts.Node[] = [];
	ts.forEachChild(node, child => {
		children.push(child);
	});
	for (const child of children) {
		yield child;
	}
}

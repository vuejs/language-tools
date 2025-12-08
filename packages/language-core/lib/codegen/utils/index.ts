import type * as ts from 'typescript';
import type { Code, Sfc, SfcBlock, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';

export const newLine = `\n`;
export const endOfLine = `;${newLine}`;
export const identifierRegex = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

const cacheMaps = new Map<SfcBlock, [content: string, Map<string, [ts.SourceFile, usages: number]>]>();

export function getTypeScriptAST(ts: typeof import('typescript'), block: SfcBlock, text: string): ts.SourceFile {
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
	block: NonNullable<Sfc['script' | 'scriptSetup']>,
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
				yield `;`;
				yield ['', block.name, end, codeFeatures.verification];
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

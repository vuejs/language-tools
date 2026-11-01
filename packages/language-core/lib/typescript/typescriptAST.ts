import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { IRBlock, TypeScript } from '../types';

const cacheMaps = new WeakMap<IRBlock, [content: string, Map<string, [ts.SourceFile, usages: number]>]>();

export function getTypeScriptAST(ts: TypeScript, block: IRBlock, text: string): ts.SourceFile {
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

export function* forEachNode(node: ts.Node): Generator<ts.Node> {
	const children: ts.Node[] = [];
	node.forEachChild(child => {
		children.push(child);
	});
	for (const child of children) {
		yield child;
	}
}

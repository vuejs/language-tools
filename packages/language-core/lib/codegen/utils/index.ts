import type * as ts from 'typescript';
import type { Code, SfcBlock, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';

export const newLine = `\n`;
export const endOfLine = `;${newLine}`;
export const combineLastMapping: VueCodeInformation = { __combineOffset: 1 };
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

export function generateSfcBlockSection(
	block: SfcBlock,
	start: number,
	end: number,
	features: VueCodeInformation,
): Code {
	return [
		block.content.slice(start, end),
		block.name,
		start,
		features,
	];
}

export function* generatePartiallyEnding(
	source: string,
	end: number,
	mark: string,
	delimiter = 'debugger',
): Generator<Code> {
	yield delimiter;
	yield [``, source, end, codeFeatures.verification];
	yield `/* PartiallyEnd: ${mark} */${newLine}`;
}

import type * as ts from 'typescript';
import type { Code, SfcBlock, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';

export const newLine = `\n`;
export const endOfLine = `;${newLine}`;
export const combineLastMapping: VueCodeInformation = { __combineOffset: 1 };
export const identifierRegex = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

export function createTsAst(
	ts: typeof import('typescript'),
	inlineTsAsts: Map<string, ts.SourceFile> | undefined,
	text: string,
) {
	let ast = inlineTsAsts?.get(text);
	if (!ast) {
		ast = ts.createSourceFile('/a.ts', text, 99 satisfies ts.ScriptTarget.ESNext);
		inlineTsAsts?.set(text, ast);
	}
	(ast as any).__volar_used = true;
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

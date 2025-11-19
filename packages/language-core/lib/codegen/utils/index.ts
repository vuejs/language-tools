import type * as CompilerDOM from '@vue/compiler-dom';
import type * as ts from 'typescript';
import type { Code, SfcBlock, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';

export const newLine = `\n`;
export const endOfLine = `;${newLine}`;
export const combineLastMapping: VueCodeInformation = { __combineOffset: 1 };
export const identifierRegex = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/;

export function normalizeAttributeValue(node: CompilerDOM.TextNode) {
	let offset = node.loc.start.offset;
	let content = node.loc.source;
	if (
		(content.startsWith(`'`) && content.endsWith(`'`))
		|| (content.startsWith(`"`) && content.endsWith(`"`))
	) {
		offset++;
		content = content.slice(1, -1);
	}
	return [content, offset] as const;
}

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

export function createSfcBlockGenerator(
	block: SfcBlock,
	start: number,
	end: number,
	features: VueCodeInformation,
) {
	const replacement: [number, number, ...Code[]][] = [];

	return {
		replace(...args: typeof replacement[number]) {
			replacement.push(args);
		},
		*generate() {
			let offset = start;
			for (const [start, end, ...codes] of replacement.sort((a, b) => a[0] - b[0])) {
				yield generateSfcBlockSection(block, offset, start, features);
				yield* codes;
				offset = end;
			}
			yield generateSfcBlockSection(block, offset, end, features);
		},
	};
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

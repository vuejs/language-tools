import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, test } from 'vitest';
import { normalizeCompilerOutput, repositoryRoot, runTsc } from './utils';

const fixtureDir = path.join(repositoryRoot, 'test-workspace/content-mapper-pug');
const fileName = 'Issues.vue';

/** The lines of each `//- #N` … `//- #N end` case of the fixture. */
const cases = new Map<string, [number, number]>();
fs.readFileSync(path.join(fixtureDir, fileName), 'utf8').split(/\r?\n/).forEach((line, i) => {
	const match = line.match(/^\/\/- (#\d+)( end)?$/);
	if (match) {
		const range = cases.get(match[1]!) ?? [0, 0];
		range[match[2] ? 1 : 0] = i + 1;
		cases.set(match[1]!, range);
	}
});

const diagnostics = normalizeCompilerOutput(
	runTsc(['-p', path.join(fixtureDir, 'tsconfig.json'), '--runExternalCode', '--pretty', 'false']),
)
	.split('\n')
	.flatMap(line => {
		const match = line.match(/(?:^|\/)Issues\.vue\((\d+),(\d+)\): error (TS\d+)/);
		return match ? [{ line: Number(match[1]), column: Number(match[2]), code: match[3]! }] : [];
	});

function diagnosticsOf(issue: string) {
	const [start, end] = cases.get(issue)!;
	return diagnostics
		.filter(diagnostic => diagnostic.line > start && diagnostic.line < end)
		.map(diagnostic => `${diagnostic.line - start}:${diagnostic.column} ${diagnostic.code}`);
}

/** The pug repros of the issues of language-tools, as lines of the case and columns. */
describe('pug issues', () => {
	test('every case has a test', () => {
		expect([...cases.keys()]).toEqual([...expected.keys()]);
	});

	const expected = new Map<string, string[]>([
		['#118', []],
		['#1357', []],
		['#1604', []],
		// the missing required prop is reported at the tag name
		['#1723', ['1:1 TS2345']],
		['#2329', []],
		['#2413', []],
		['#2447', []],
		['#3659', []],
		['#4335', []],
		['#50', []],
		['#5099', []],
		['#5899', []],
		['#5914', []],
		['#5921', []],
		['#5922', []],
		['#5970', []],
	]);
	for (const [issue, codes] of expected) {
		test(issue, () => {
			expect(diagnosticsOf(issue)).toEqual(codes);
		});
	}
});

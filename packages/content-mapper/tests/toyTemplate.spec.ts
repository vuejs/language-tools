import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { normalizeCompilerOutput, repositoryRoot, runTsc } from './utils';

/**
 * `toy.cjs` exports only `ir.templateCompilers.toy`, `(source) => ({ pieces })`: the shape that a template
 * language such as NMBL or Fumi needs to load. `Toy.vue` and `Html.vue` have the same template, a line each.
 */
const fixtureDir = path.join(repositoryRoot, 'test-workspace/content-mapper-toy');

test('a template language of the `ir` API type-checks the same as HTML', () => {
	const output = normalizeCompilerOutput(
		runTsc(['-p', path.join(fixtureDir, 'tsconfig.json'), '--runExternalCode', '--pretty', 'false']),
	);
	const diagnosticsOf = (fileName: string) => {
		const lines = fs.readFileSync(path.join(fixtureDir, fileName), 'utf8').split(/\r?\n/);
		return output.split('\n').flatMap(line => {
			const match = line.match(new RegExp(`(?:^|/)${fileName}\\((\\d+),(\\d+)\\): error (TS\\d+): (.*)$`));
			if (!match) {
				return [];
			}
			const [, row, column, code, message] = match;
			const word = lines[Number(row) - 1]!.slice(Number(column) - 1).match(/^\w+/)?.[0];
			return [{ line: Number(row), code, word, message }];
		});
	};

	expect(diagnosticsOf('Toy.vue')).toEqual(diagnosticsOf('Html.vue'));
	expect(diagnosticsOf('Toy.vue').map(({ line, code, word }) => `${line} ${code} ${word}`)).toEqual([
		'10 TS2339 missing',
		'8 TS2345 Child',
	]);
});

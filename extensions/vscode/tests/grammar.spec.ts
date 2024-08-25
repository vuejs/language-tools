import * as path from 'path';
import * as fs from 'fs';
import { describe, expect, it } from 'vitest';
import { createGrammarSnapshot } from 'vscode-tmlanguage-snapshot';

const fixturesDir = path.resolve(__dirname, './grammarFixtures');
const packageJsonPath = path.resolve(__dirname, '../package.json');

describe('grammar', async () => {
	const snapshot = await createGrammarSnapshot(packageJsonPath);
	const fixtures = fs.readdirSync(fixturesDir);

	for (const fixture of fixtures) {
		it.skipIf(fixture === 'snippet-import.md')(fixture, async () => {
			const result = await snapshot(`tests/grammarFixtures/${fixture}`);

			expect(result).toMatchSnapshot();
		});
	}
});

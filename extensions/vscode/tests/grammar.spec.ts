import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGrammarSnapshot } from 'vscode-tmlanguage-snapshot';

const grammarsSync = import('../scripts/grammars-sync');
const fixturesDir = path.resolve(__dirname, './grammarFixtures');
const embeddedFixturesDir = path.resolve(__dirname, './embeddedGrammarFixtures');
const packageJsonPath = path.resolve(__dirname, '../package.json');

describe('grammar', async () => {
	await grammarsSync;
	const snapshot = await createGrammarSnapshot(packageJsonPath);
	const fixtures = fs.readdirSync(fixturesDir);

	for (const fixture of fixtures) {
		it.skipIf(fixture === 'snippet-import.md')(fixture, async () => {
			const result = await snapshot(`tests/grammarFixtures/${fixture}`);

			expect(result).toMatchSnapshot();
		});
	}
});

describe('embedded grammar', async () => {
	await grammarsSync;
	const embeddedGrammarsDir = path.resolve(__dirname, './embeddedGrammars');
	const snapshot = await createGrammarSnapshot(packageJsonPath, {
		extraGrammarPaths: [
			path.resolve(embeddedGrammarsDir, './typescript.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './javascript.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './css.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './scss.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './html.tmLanguage.json'),
		],
	});
	const fixtures = fs.readdirSync(embeddedFixturesDir);

	for (const fixture of fixtures) {
		it(fixture, async () => {
			const result = await snapshot(`tests/embeddedGrammarFixtures/${fixture}`);

			expect(result).toMatchSnapshot();
		});
	}
});

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGrammarSnapshot } from 'vscode-tmlanguage-snapshot';
import { generateArtifacts } from '../scripts/generate-grammar';

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
			path.resolve(embeddedGrammarsDir, './typescriptreact.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './javascriptreact.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './javascript.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './css.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './scss.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './html.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './html-derivative.tmLanguage.json'),
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

// The committed grammars + language configuration are generated output of `vue.monogram.ts` +
// the Monogram submodule. This guards against drift: editing the source or bumping the submodule
// without re-running `npm run gen:grammar` fails here. Structural compare ignores `dprint`
// formatting (and the language config's `// …` JSONC comments, dropped by generation).
describe('generated artifacts are in sync with source', () => {
	const extensionRoot = path.resolve(__dirname, '..');
	const stripJsonComments = (text: string) => text.replace(/^\s*\/\/.*$/gm, '');

	for (const [relPath, artifact] of Object.entries(generateArtifacts())) {
		it(relPath, () => {
			const committed = JSON.parse(stripJsonComments(fs.readFileSync(path.resolve(extensionRoot, relPath), 'utf8')));
			expect(committed).toEqual(artifact);
		});
	}
});

import * as fs from 'node:fs';
import { createRequire } from 'node:module';
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

it('component tags exclude exactly the native tags of the Vue compiler', () => {
	const require = createRequire(import.meta.url);
	const sharedPath = require.resolve('@vue/shared', { paths: [require.resolve('@vue/language-core')] });
	const sharedSource = fs.readFileSync(sharedPath.replace(/index\.js$/, 'dist/shared.cjs.js'), 'utf8');
	const nativeTags = new Set(
		['HTML_TAGS', 'SVG_TAGS', 'MATH_TAGS'].flatMap(name =>
			sharedSource.match(new RegExp(`const ${name} = "([^"]+)"`))![1]!.split(',')
		),
	);
	// not a native tag, but the compiler resolves it as a slot outlet before checking for components
	nativeTags.add('slot');

	const grammar = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../syntaxes/vue.tmLanguage.json'), 'utf8'));
	for (const rule of grammar.repository['component-tag'].patterns) {
		const excluded: string[] = (rule.begin ?? rule.match).match(/\(\?!\(\?:([^)]+)\)/)[1].split('|');
		expect(new Set(excluded)).toEqual(nativeTags);
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

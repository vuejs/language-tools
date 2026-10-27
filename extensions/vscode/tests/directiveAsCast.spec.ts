import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGrammarSnapshot } from 'vscode-tmlanguage-snapshot';

const grammarsSync = import('../scripts/grammars-sync');
const packageJsonPath = path.resolve(__dirname, '../package.json');
const embeddedGrammarsDir = path.resolve(__dirname, './embeddedGrammars');

// Scopes of the token covering `line[col]`, read from the snapshot text.
// Source lines are prefixed with `>`, token lines with `#` and carets under the source columns.
function scopesAt(snapshot: string, line: string, col: number) {
	const lines = snapshot.split('\n');
	let i = lines.indexOf('>' + line) + 1;
	expect(i).toBeGreaterThan(0);
	for (; lines[i]?.startsWith('#'); i++) {
		const match = lines[i].match(/^#( *)(\^+) (.*)$/)!;
		const start = match[1].length;
		if (col >= start && col < start + match[2].length) {
			return match[3].split(' ');
		}
	}
	return [];
}

// https://github.com/vuejs/language-tools/issues/6296
describe('as/satisfies in directive value', async () => {
	await grammarsSync;
	const snapshot = await createGrammarSnapshot(packageJsonPath, {
		extraGrammarPaths: ['typescript', 'javascript', 'css', 'scss', 'html'].map(name =>
			path.resolve(embeddedGrammarsDir, `./${name}.tmLanguage.json`)
		),
	});
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vue-grammar-'));

	const cases = [
		`v-for="item in list as any[]"`,
		`:foo="value as string"`,
		`:foo='value as string'`,
		`:foo="value satisfies string"`,
		`:foo="value as Array<string>"`,
		`:foo="value as 'a' | 'b'"`,
		`@click="handler(value as string)"`,
		`v-if="value as boolean"`,
	];

	for (const attr of cases) {
		it(`ends the attribute at its closing quote: ${attr}`, async () => {
			const line = `\t<div ${attr} :bar="1"></div>`;
			const file = path.join(tmpDir, 'test.vue');
			fs.writeFileSync(file, `<template>\n${line}\n</template>\n`);
			const result = await snapshot(file);

			const closingQuote = line.indexOf(attr) + attr.length - 1;
			expect(scopesAt(result, line, closingQuote)).toContain('punctuation.definition.string.end.html.vue');
			expect(scopesAt(result, line, line.indexOf('bar'))).toContain('entity.other.attribute-name.html.vue');
		});
	}
});

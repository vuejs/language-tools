// Tokenizes a .vue source string through the GENERATED Vue grammar + its injections, the same
// way VS Code does — via `vscode-tmlanguage-snapshot` resolving the grammar/injection set from
// the extension's `package.json` `contributes`. Ported from monogram's vue-grammar-harness.ts
// (mono-only): the Vue correctness gates that lived in monogram assert tokenization PROPERTIES
// (not snapshots), so they move here with this `tokenize(src)` helper.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { createGrammarSnapshot } from 'vscode-tmlanguage-snapshot';

const packageJsonPath = path.resolve(__dirname, '../package.json');
const embeddedGrammarsDir = path.resolve(__dirname, './embeddedGrammars');

// CSS dialects the Vue grammar can embed but for which we ship no grammar (only css + scss are
// real). A one-scope stub keeps the dialect scope resolvable, so a `<style lang="less">` body
// still carries source.css.less — mirroring monogram's harness — without a full dialect grammar.
const stubsDir = mkdtempSync(path.join(tmpdir(), 'vue-css-stubs-'));
const stub = (scopeName: string) => {
	const file = path.join(stubsDir, `${scopeName}.json`);
	writeFileSync(file, JSON.stringify({ scopeName, patterns: [{ match: '[^\\n]+', name: scopeName }] }));
	return file;
};

// The embedded grammars are downloaded (not committed) by scripts/grammars-sync — await it first,
// like grammar.spec.ts, so this harness doesn't read them before they exist (a CI race otherwise).
const snapshotPromise = import('../scripts/grammars-sync').then(() =>
	createGrammarSnapshot(packageJsonPath, {
		extraGrammarPaths: [
			path.resolve(embeddedGrammarsDir, './typescript.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './typescriptreact.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './javascriptreact.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './javascript.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './css.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './scss.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './html.tmLanguage.json'),
			path.resolve(embeddedGrammarsDir, './html-derivative.tmLanguage.json'),
			...['source.css.less', 'source.sass', 'source.stylus', 'source.postcss'].map(stub),
		],
	})
);

interface Tok {
	startIndex: number;
	endIndex: number;
	scopes: string[];
}

// Parse the tool's rendered snapshot (a `>source` line, then `#  ^^^ scope scope…` token lines)
// back into per-line token arrays.
function parseSnapshot(rendered: string): Tok[][] {
	const lines: Tok[][] = [];
	let cur: Tok[] | null = null;
	for (const row of rendered.split('\n')) {
		if (row[0] === '>') {
			cur = [];
			lines.push(cur);
		}
		else if (row[0] === '#' && cur) {
			const m = /^#( *)(\^+) (.*)$/.exec(row);
			if (m) {
				cur.push({ startIndex: m[1].length, endIndex: m[1].length + m[2].length, scopes: m[3].split(' ') });
			}
		}
	}
	return lines;
}

const work = mkdtempSync(path.join(tmpdir(), 'vue-harness-'));
let counter = 0;

// Per-line token arrays for a source. A fresh fixture path per call avoids any path-keyed
// snapshot caching.
async function tokenizeLines(src: string): Promise<Tok[][]> {
	const snapshot = await snapshotPromise;
	const fixture = path.join(work, `case-${counter++}.vue`);
	writeFileSync(fixture, src);
	return parseSnapshot(await snapshot(fixture));
}

export interface TextTok {
	text: string;
	scopes: string;
}

// Flat list of non-whitespace tokens with space-joined scopes — find a token by exact text and
// inspect its scope chain.
export async function tokenize(src: string): Promise<TextTok[]> {
	const lineToks = await tokenizeLines(src);
	const lines = src.split('\n');
	const out: TextTok[] = [];
	for (let li = 0; li < lineToks.length; li++) {
		const line = lines[li] ?? '';
		for (const t of lineToks[li]) {
			const text = line.slice(t.startIndex, t.endIndex);
			if (text.trim()) {
				out.push({ text, scopes: t.scopes.join(' ') });
			}
		}
	}
	return out;
}

// offset → scopes[] lookup over a tokenized source — for checks whose target spans multiple
// tokens (the issue-case corpus looks up the scope at the middle of a substring occurrence).
export async function scopeLookup(src: string): Promise<(offset: number) => string[]> {
	const lineToks = await tokenizeLines(src);
	const lineStart: number[] = [];
	let acc = 0;
	for (const line of src.split('\n')) {
		lineStart.push(acc);
		acc += line.length + 1;
	}
	return (offset: number) => {
		let li = 0;
		while (li + 1 < lineStart.length && lineStart[li + 1] <= offset) li++;
		const col = offset - lineStart[li];
		for (const t of lineToks[li] ?? []) {
			if (col >= t.startIndex && col < t.endIndex) return t.scopes;
		}
		return [];
	};
}

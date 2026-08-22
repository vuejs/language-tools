import { describe, expect, it } from 'vitest';
import grammar from '../vue.monogram';
import { scopeLookup, type TextTok, tokenize } from './vueGrammarHarness';
import { cases } from './vueIssueCases';

// Vue highlighting correctness gates, ported from monogram (vue-directives / vue-embed-boundary /
// vue-interp-expr / vue-raw-style-embed-sites / vue-issue-cases). They assert tokenization
// PROPERTIES of the generated grammar — stronger than the snapshot fixtures — and embed the real
// VS Code TS/JS/CSS grammars (this repo's embeddedGrammars), so the asserted scopes are what an
// editor actually produces.
const find = (toks: TextTok[], text: string, pred: (scopes: string) => boolean = () => true) =>
	toks.find(t => t.text === text && pred(t.scopes));

describe('vue directives + interpolation', async () => {
	const sfc = [
		'<template>',
		'  <ul id="main">',
		'    <li v-for="item in items" :key="item.id" @click="go(item)">',
		'      {{ item.name + 1 }}',
		'    </li>',
		'    <p v-if="show">x</p>',
		'  </ul>',
		'</template>',
	].join('\n');
	const toks = await tokenize(sfc);

	it('v-for → keyword.control.loop.vue', () =>
		expect(find(toks, 'v-for', s => s.includes('keyword.control.loop.vue'))).toBeTruthy());
	it('v-if → keyword.control.conditional.vue', () =>
		expect(find(toks, 'v-if', s => s.includes('keyword.control.conditional.vue'))).toBeTruthy());
	it(': v-bind shorthand → punctuation.attribute-shorthand.bind', () =>
		expect(find(toks, ':', s => s.includes('punctuation.attribute-shorthand.bind'))).toBeTruthy());
	it('@ v-on shorthand → punctuation.attribute-shorthand.event', () =>
		expect(find(toks, '@', s => s.includes('punctuation.attribute-shorthand.event'))).toBeTruthy());

	it('v-for value `item` → embedded TS variable', () =>
		expect(find(toks, 'item', s => s.includes('source.ts') && s.includes('variable'))).toBeTruthy());
	it('v-for value `in` → embedded TS keyword', () =>
		expect(find(toks, 'in', s => s.includes('source.ts') && s.includes('keyword'))).toBeTruthy());
	it('@click value `go` → embedded TS', () => expect(find(toks, 'go', s => s.includes('source.ts'))).toBeTruthy());

	it('{{ → interpolation.begin', () =>
		expect(find(toks, '{{', s => s.includes('punctuation.definition.interpolation.begin'))).toBeTruthy());
	it('}} → interpolation.end', () =>
		expect(find(toks, '}}', s => s.includes('punctuation.definition.interpolation.end'))).toBeTruthy());
	it('interpolation body `1` → embedded TS numeric', () =>
		expect(find(toks, '1', s => s.includes('source.ts') && s.includes('constant.numeric'))).toBeTruthy());

	it('plain attr value `main` stays HTML, not TS', () =>
		expect(find(toks, 'main', s => s.includes('string') && !s.includes('source.ts'))).toBeTruthy());
});

// An embedded grammar (the editor's TS/JS) must not consume past the host's structural boundary,
// even when its own region is open mid-construct.
describe('vue embed boundary', () => {
	it('#1666: trailing `type Foo = 123` then </script> — embed ends, template is not swallowed', async () => {
		const t = await tokenize('<script lang="ts">\ntype Foo = 123\n</script>\n<template><b /></template>');
		expect(find(t, 'type', s => s.includes('source.ts') && s.includes('storage.type'))).toBeTruthy();
		expect(t.some(tk => tk.text === 'template' && tk.scopes.includes('source.ts'))).toBe(false);
		expect(t.some(tk => tk.text === 'b' && tk.scopes.includes('source.ts'))).toBe(false);
	});

	it('#5012: `:value="msg as string"` — the as-cast is bounded by the quote', async () => {
		const t = await tokenize(
			'<template>\n  <b :value="msg as string">ok</b>\n</template>\n<script>const z = 1</script>',
		);
		expect(find(t, 'as', s => s.includes('source.ts'))).toBeTruthy();
		expect(t.some(tk => tk.text === 'ok' && tk.scopes.includes('source.ts'))).toBe(false);
		expect(find(t, 'b', s => s.includes('entity.name.tag') && !s.includes('source.ts'))).toBeTruthy();
		expect(find(t, 'const', s => s.includes('source.js') && s.includes('storage.type'))).toBeTruthy();
	});

	it('#3999: multi-line `<script lang="ts">` start tag — body still embeds as TS', async () => {
		const t = await tokenize('<script\n  lang="ts"\n>\nconst mlx = 1\n</script>');
		expect(find(t, 'const', s => s.includes('source.ts') && s.includes('storage.type'))).toBeTruthy();
		const t2 = await tokenize('<script\n  setup\n>\nvar mly = 1\n</script>');
		expect(find(t2, 'var', s => s.includes('source.js'))).toBeTruthy();
	});
});

// `{{ }}` / directive values embed an EXPRESSION (source.ts#expression), not a whole program: a
// statement keyword at the top must not highlight, an expression operator must, and a statement in
// a nested block must (it re-enters $self).
describe('vue interpolation expression scoping', () => {
	const wrap = (expr: string) => `<template>\n  <p>{{ ${expr} }}</p>\n</template>`;
	const tok = (toks: TextTok[], text: string) => toks.find(t => t.text === text);

	it('`{{ const foo }}`: const reaches the embed but is NOT storage.type', async () => {
		const k = tok(await tokenize(wrap('const foo = 1')), 'const');
		expect(k?.scopes.includes('source.ts')).toBe(true);
		expect(k?.scopes.includes('storage.type')).toBe(false);
	});
	it('`{{ return x }}`: return is NOT keyword.control', async () => {
		const k = tok(await tokenize(wrap('return x')), 'return');
		expect(k && !k.scopes.includes('keyword.control')).toBeTruthy();
	});
	it('`{{ for }}`: for is NOT keyword.control', async () => {
		const k = tok(await tokenize(wrap('for (;;) {}')), 'for');
		expect(k && !k.scopes.includes('keyword.control')).toBeTruthy();
	});
	it('`{{ typeof x }}`: typeof IS keyword.operator', async () => {
		const k = tok(await tokenize(wrap('typeof x')), 'typeof');
		expect(k?.scopes.includes('keyword.operator')).toBe(true);
	});
	// `as` is an expression operator that must stay highlighted (not suppressed like a statement
	// keyword). VS Code's TS grammar scopes the cast `as` as keyword.control.as.ts, so assert the
	// keyword family rather than monogram's keyword.operator.
	it('`{{ x as Foo }}`: as stays a keyword (highlighted)', async () => {
		const k = tok(await tokenize(wrap('x as Foo')), 'as');
		expect(k?.scopes.includes('keyword')).toBe(true);
	});
	it('`{{ new Date() }}`: new IS scoped', async () => {
		const k = tok(await tokenize(wrap('new Date()')), 'new');
		expect(k && (k.scopes.includes('keyword.operator') || k.scopes.includes('new'))).toBeTruthy();
	});
	it('#5722: ternary `:` in {{ }} is NOT a v-bind shorthand and highlighting recovers', async () => {
		const t = await tokenize(wrap("ok ? 'a' : 'b'"));
		const colon = tok(t, ':');
		expect(colon && !colon.scopes.includes('attribute-shorthand')).toBeTruthy();
		const closeTags = t.filter(tk => tk.text === 'template');
		expect(closeTags.length > 0 && closeTags.every(tk => !tk.scopes.includes('source.ts'))).toBe(true);
	});
	it('nested `{{ (()=>{const x})() }}`: const IS storage.type (re-enters $self)', async () => {
		const k = tok(await tokenize(wrap('(() => { const x = 1 })()')), 'const');
		expect(k?.scopes.includes('storage.type')).toBe(true);
	});
});

// A `<style lang="X">` body must embed the CSS dialect the grammar declares, at every structural
// position. Oracle = the grammar's own embed map (closed loop, no hand-written grammar needed).
describe('vue raw-style embed', () => {
	const style = (grammar as any).markup?.rawText?.embed?.style;
	const dialects: [string | null, string][] = [
		[null, style.default],
		...Object.entries(style.lang as Record<string, string>).map(([k, v]) => [k, v] as [string, string]),
	];
	const witnesses = (lang: string | null) => {
		const open = lang === null ? '<style>' : `<style lang="${lang}">`;
		return [
			{ pos: 'content-line', src: `${open}\n.midline { a: 1 }\n</style>`, find: 'midline' },
			{ pos: 'close-line', src: `${open}\n.firstline { a: 1 }\n.closeline { b: 2 }</style>`, find: 'closeline' },
			{ pos: 'single-line', src: `${open}.oneline { c: 3 }</style>`, find: 'oneline' },
		];
	};

	for (const [lang, expected] of dialects) {
		for (const w of witnesses(lang)) {
			it(`<style ${lang === null ? '(default)' : `lang="${lang}"`}> @ ${w.pos} → ${expected}`, async () => {
				const toks = await tokenize(w.src);
				const t = toks.find(x => x.text.includes(w.find));
				expect(t?.scopes.split(' ')).toContain(expected);
			});
		}
	}
});

// Real reported issues against the Vue grammar — a regression corpus. Each check looks up the
// scope at the middle of `at`'s nth occurrence (mirroring monogram's bench).
describe('vue issue regressions', () => {
	for (const c of cases) {
		it(`${c.id} ${c.title}`, async () => {
			const look = await scopeLookup(c.src);
			const at = (text: string, nth = 0) => {
				let i = -1;
				for (let k = 0; k <= nth; k++) i = c.src.indexOf(text, i + 1);
				return i < 0 ? '__NOT_FOUND__' : look(i + Math.floor(text.length / 2)).join(' ');
			};
			for (const ch of c.checks) {
				expect(ch.want(at(ch.at, ch.nth)), `${c.id}: ${ch.desc} (at ${JSON.stringify(ch.at)})`).toBe(true);
			}
		});
	}
});

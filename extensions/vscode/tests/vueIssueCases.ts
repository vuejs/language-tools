// Real highlighting issues reported against vuejs/language-tools' Vue grammar, as DATA — ported
// from monogram's vue-issue-cases.ts so the regression corpus survives the grammar's move here.
// Each `id` is the tracker #issue; each check looks up the scope at the middle of `at`'s nth
// occurrence and asserts `want`. Predicates are family-level (robust across the embedded TS/JS/CSS
// grammar versions) except where a specific scope is the point of the case.
export const familyOf = (s: string): string =>
	s.includes('source.ts')
		? 'ts'
		: s.includes('source.js')
		? 'js'
		: s.includes('source.css')
		? 'css'
		: s.includes('text.html')
		? 'html'
		: 'other';
export const embedded = (s: string) => s.includes('source.ts') || s.includes('source.js');
export const htmlText = (s: string) => familyOf(s) === 'html'; // recovered to HTML (didn't leak into the embed)
// A close-tag NAME that stayed clean tag punctuation — `entity.name.tag` present and the leaked
// embedded-code scopes (regexp/type from a runaway source.*) absent.
export const isCloseTag = (s: string) =>
	s.includes('entity.name.tag') && !s.includes('string.regexp') && !s.includes('meta.type');
export const DONE = '\n  <b>DONE</b>\n</template>'; // downstream marker — must recover to HTML

export interface Check {
	at: string;
	nth?: number;
	want: (s: string) => boolean;
	desc: string;
}
export interface Case {
	id: string;
	title: string;
	src: string;
	checks: Check[];
}

export const cases: Case[] = [
	// ── TS operators inside template expressions — the embedded proven TS gets these free ──
	{
		id: '#3400',
		title: '`instanceof` in {{ }}',
		src: `<template>\n  <div>{{ err instanceof Error }}</div>${DONE}`,
		checks: [{ at: 'instanceof', want: embedded, desc: 'instanceof embeds as TS' }, {
			at: 'DONE',
			want: htmlText,
			desc: 'downstream recovers to HTML',
		}],
	},
	{
		id: '#5370',
		title: '`typeof x !==` in v-if',
		src: `<template>\n  <p v-if="typeof x !== 'number'">a</p>${DONE}`,
		checks: [{ at: 'typeof', want: embedded, desc: 'typeof embeds as TS' }, {
			at: 'DONE',
			want: htmlText,
			desc: 'downstream recovers',
		}],
	},
	{
		id: '#5118',
		title: '`?.` / `??` in {{ }}',
		src: `<template>\n  <div>{{ a?.b ?? c }}</div>${DONE}`,
		checks: [{ at: '??', want: embedded, desc: 'nullish embeds as TS' }, {
			at: 'DONE',
			want: htmlText,
			desc: 'downstream recovers',
		}],
	},
	{
		id: '#1675',
		title: 'arrow `=>` in {{ }}',
		src: `<template>\n  <div>{{ items.map(i => i.id) }}</div>${DONE}`,
		checks: [{ at: '=>', want: embedded, desc: 'arrow embeds as TS' }, {
			at: 'DONE',
			want: htmlText,
			desc: 'downstream recovers',
		}],
	},
	{
		id: '#6039/#4741',
		title: '`<` operator in {{ }} (not a tag!)',
		src: `<template>\n  <div>{{ a < b }}</div>${DONE}`,
		checks: [{ at: 'DONE', want: htmlText, desc: 'the `<` is not mistaken for a tag — downstream recovers' }],
	},
	{
		id: '#5722',
		title: 'negated ternary + quotes in {{ }}',
		src: `<template>\n  <div>{{ !ok ? 'yes' : 'no' }}</div>${DONE}`,
		checks: [{ at: 'DONE', want: htmlText, desc: 'downstream recovers' }],
	},
	// ── `as` type assertion (the #5012 intra-line ceiling family) ──
	{
		id: '#6007/#2096/#520',
		title: '`as` type assertion in directive value',
		src: `<template>\n  <Foo :schema="x as JSONSchema" />${DONE}`,
		checks: [{ at: 'as', want: embedded, desc: '`as` embeds as TS' }, {
			at: 'DONE',
			want: htmlText,
			desc: 'downstream recovers (begin/while bounds it)',
		}],
	},
	// ── script / boundary family ──
	{
		id: '#5538/#2060',
		title: 'trailing `export type` before `</script>`',
		src: `<script lang="ts">\nexport type T = number\n</script>\n<template>\n  <p>hi</p>${DONE}`,
		checks: [{ at: 'hi', want: htmlText, desc: '</script> ends the embed — template is HTML' }, {
			at: 'DONE',
			want: htmlText,
			desc: 'downstream recovers',
		}],
	},
	{
		id: '#2060-inline',
		title: '`const a = 1;</script>` (content on the close line) embeds + clean close',
		src: `<script setup lang="ts">\nconst a = 1;</script>`,
		checks: [{ at: 'const', want: embedded, desc: 'the const on the close line still embeds as TS' }, {
			at: '/script',
			want: isCloseTag,
			desc: 'the </script> is clean tag punctuation, not swallowed into source.ts',
		}],
	},
	{
		id: '#2060-inline-adjacent',
		title: 'an unterminated union before a same-line `</script>`, then a second `<script setup>` block',
		src:
			`<script lang="ts">\nexport type ButtonType = 'a' | 'b'</script>\n<script setup lang="ts">\ndefineProps<{ type: ButtonType }>()\n</script>`,
		checks: [
			{ at: `| 'b'`, want: embedded, desc: 'the union tail before the same-line </script> still embeds as TS' },
			{
				at: '/script',
				want: isCloseTag,
				desc: 'the first </script> is clean tag punctuation, not leaked into source.ts',
			},
			{ at: 'defineProps', want: embedded, desc: 'the second block recovers and embeds as TS' },
		],
	},
	{
		id: '#3999',
		title: 'a force-wrapped multi-line `<script lang="ts">` start tag keeps the body as the `ts` family',
		src: `<script\n  setup\n  lang="ts"\n>\ninterface I { x: number }\nconst x = 1\n</script>`,
		checks: [{
			at: 'interface',
			want: s => familyOf(s) === 'ts' && s.includes('storage.type.interface.ts'),
			desc:
				'the `interface` keyword is TS-only: source.ts across the multi-line start tag — no source.ts→source.js flip',
		}, { at: 'const', want: s => familyOf(s) === 'ts', desc: 'the rest of the body is still the ts family, not js' }],
	},
	// ── tag / interpolation edge cases ──
	{
		id: '#4769',
		title: 'tag name starting with `template`',
		src: `<template>\n  <templatex>{{ y }}</templatex>${DONE}`,
		checks: [{ at: 'y', want: embedded, desc: 'interpolation inside a template-prefixed tag works' }, {
			at: 'DONE',
			want: htmlText,
			desc: 'downstream recovers',
		}],
	},
	{
		id: '#5701',
		title: '`{{` inside a `<script>` string',
		src: `<script>\nconst s = "{{ not interp }}"\n</script>\n<template>\n  <p>{{ real }}</p>${DONE}`,
		checks: [{ at: 'real', want: embedded, desc: 'the real interpolation still embeds as TS' }, {
			at: 'DONE',
			want: htmlText,
			desc: 'downstream recovers',
		}],
	},
	{
		id: '#6070',
		title: 'capitalized component then a `<style>` block',
		src: `<template>\n  <MyComp @click="f">x</MyComp>\n</template>\n<style>\n.a { color: red }\n</style>`,
		checks: [{
			at: 'color',
			want: s => familyOf(s) === 'css',
			desc: '<style> after a capitalized tag still embeds as CSS',
		}],
	},
	// ── more of the `as`-cast leak family (the #5012 intra-line ceiling) ──
	{
		id: '#5660',
		title: '`as const` cast in a v-for value',
		src: `<template>\n  <div v-for="i in [0,1,2] as const">{{ i }}</div>${DONE}`,
		checks: [{ at: 'as', want: embedded, desc: '`as const` embeds as TS' }, {
			at: '{{',
			want: htmlText,
			desc: 'the interpolation opener is HTML — the cast did not leak past the closing quote',
		}, { at: 'DONE', want: htmlText, desc: 'downstream recovers to HTML' }],
	},
	{
		id: '#4716/#5571',
		title: '`as` cast followed by another attribute',
		src: `<template>\n  <some-comp :value="foo as boolean" :other="bar" />${DONE}`,
		checks: [{ at: 'as', want: embedded, desc: '`as` embeds as TS' }, {
			at: 'bar',
			want: embedded,
			desc: 'the NEXT directive value still embeds as TS — the cast cannot eat the closing quote',
		}, { at: 'DONE', want: htmlText, desc: 'downstream recovers' }],
	},
	// ── block-language attribute — each declared script.lang embeds its DECLARED scope ──
	{
		id: '#4291',
		title: '`<script lang="tsx">` body embeds the DECLARED `source.tsx`',
		src: `<script setup lang="tsx">\nconst n = 1\n</script>\n<template>\n  <p>x</p>${DONE}`,
		checks: [{
			at: 'n = 1',
			want: s => s.includes('source.tsx'),
			desc: 'the tsx script body embeds as source.tsx — its declared scope, not the default source.js',
		}, { at: 'DONE', want: htmlText, desc: 'downstream recovers' }],
	},
	{
		id: '#4291-jsx',
		title: '`<script lang="jsx">` body embeds the DECLARED `source.js.jsx`',
		src: `<script setup lang="jsx">\nconst n = 1\n</script>\n<template>\n  <p>x</p>${DONE}`,
		checks: [{
			at: 'n = 1',
			want: s => s.includes('source.js.jsx'),
			desc: 'the jsx script body embeds as source.js.jsx — its declared scope',
		}, { at: 'DONE', want: htmlText, desc: 'downstream recovers' }],
	},
	// ── generic="…"> type-param attribute (PR #6085 drop-in) ──
	{
		id: 'generic="T"',
		title: '`generic="T extends U">` type-param list embeds as TS',
		src: `<script setup lang="ts" generic="T extends U">\nconst n = 1\n</script>${DONE}`,
		checks: [
			{
				at: 'extends',
				want: s => s.includes('storage.modifier'),
				desc:
					'the variance modifier `extends` → storage.modifier — the type-param list is tokenized as TS, not a plain string',
			},
			{ at: 'n = 1', want: embedded, desc: 'the script body still embeds as TS' },
			{ at: 'DONE', want: htmlText, desc: 'downstream recovers' },
		],
	},
	// ── dynamic directive args + `.prop` shorthand ──
	{
		id: '#4410',
		title: 'dynamic directive argument `:[attr]`',
		src: `<template>\n  <a :[attr]="url">x</a>${DONE}`,
		checks: [{ at: 'attr', want: embedded, desc: 'the `[attr]` dynamic argument is a JS expression — embeds as TS' }, {
			at: 'url',
			want: embedded,
			desc: 'the value embeds as TS',
		}, { at: 'DONE', want: htmlText, desc: 'downstream recovers' }],
	},
	{
		id: '#3727',
		title: '`.prop` modifier shorthand',
		src: `<template>\n  <my-comp .prop="value" />${DONE}`,
		checks: [
			{ at: 'value', want: embedded, desc: '`.prop` is `v-bind:prop.prop` shorthand — its value embeds as TS' },
			{ at: 'DONE', want: htmlText, desc: 'downstream recovers' },
		],
	},
	{
		id: '#2666',
		title: 'dynamic slot name from a template literal',
		src: '<template>\n  <Comp v-slot:[`item-${idx}`]="props">{{ props }}</Comp>' + DONE,
		checks: [{ at: 'idx', want: embedded, desc: 'the `${idx}` inside the template-literal slot name embeds as TS' }, {
			at: 'props }}',
			want: embedded,
			desc: 'the slot-props value embeds as TS',
		}, { at: 'DONE', want: htmlText, desc: 'downstream recovers' }],
	},
	// ── v-for loop var named after a TS keyword ──
	{
		id: '#2560/#1290',
		title: '`type` as a v-for loop variable',
		src: `<template>\n  <div v-for="type in items">{{ type }}</div>${DONE}`,
		checks: [{
			at: 'type }}',
			want: embedded,
			desc: 'the loop variable named `type` embeds as TS — no keyword-trap break',
		}, { at: 'DONE', want: htmlText, desc: 'downstream recovers' }],
	},
];

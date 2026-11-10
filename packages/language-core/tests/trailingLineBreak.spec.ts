import * as ts from 'typescript';
import { expect, test } from 'vitest';
import { createLanguage, createVueLanguagePlugin, forEachEmbeddedCode, getDefaultCompilerOptions } from '../index';

function generate(source: string) {
	const language = createLanguage<string>(
		[createVueLanguagePlugin<string>(ts, {}, getDefaultCompilerOptions(), fileName => fileName)],
		new Map(),
		() => {},
	);
	const root = language.scripts.set('/Comp.vue', ts.ScriptSnapshot.fromString(source), 'vue')!.generated!.root;
	const script = [...forEachEmbeddedCode(root)].find(code => code.id === 'script_ts')!;
	return script.snapshot.getText(0, script.snapshot.getLength());
}

test('script setup content without trailing newline keeps generated declarations on their own line', () => {
	const text = generate(`<script setup lang="ts">defineProps<{ msg: string }>()</script><template><div>{{ msg }}</div></template>`);
	const start = text.indexOf('const __VLS_props');
	const end = text.indexOf('const __VLS_ctx');
	expect(text.slice(start, end)).toMatchInlineSnapshot(`
		"const __VLS_props = defineProps<__VLS_Props>()
		type __VLS_PublicProps = __VLS_Props;
		"
	`);
});

test('script content without trailing newline keeps generated export on its own line', () => {
	const text = generate(`<script lang="ts">const a = 1</script><template><div>{{ a }}</div></template>`);
	const start = text.indexOf('const a = 1');
	const end = text.indexOf('const __VLS_ctx');
	expect(text.slice(start, end)).toMatchInlineSnapshot(`
		"const a = 1
		const __VLS_export = (await import('vue')).defineComponent({});
		"
	`);
});

test('script and script setup content without trailing newline keeps generated export on its own line', () => {
	const text = generate(`<script lang="ts">const a = 1</script><script setup lang="ts">const b = 2</script><template><div>{{ a }}{{ b }}</div></template>`);
	const start = text.indexOf('const a = 1');
	const end = text.indexOf('const __VLS_export');
	expect(text.slice(start, end)).toMatchInlineSnapshot(`
		"const a = 1
		export default {} as typeof __VLS_export;
		"
	`);
});

test('script content after default export without trailing newline keeps generated export on its own line', () => {
	const text = generate(`<script lang="ts">export default {}\nconst x = 1</script><script setup lang="ts">const y = 2</script><template><div>{{ y }}</div></template>`);
	const start = text.indexOf('const x = 1');
	const end = text.indexOf('const __VLS_ctx');
	expect(text.slice(start, end)).toMatchInlineSnapshot(`
		"const x = 1
		const __VLS_export = await (async () => {
		const y = 2
		"
	`);
});

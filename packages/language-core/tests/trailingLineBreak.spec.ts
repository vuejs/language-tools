import * as ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { createLanguage, createVueLanguagePlugin, forEachEmbeddedCode, getDefaultCompilerOptions } from '../index';

function generate(source: string) {
	const language = createLanguage<string>(
		[createVueLanguagePlugin<string>(ts, {}, getDefaultCompilerOptions(), fileName => fileName)],
		new Map(),
		() => {},
	);
	const sourceScript = language.scripts.set('/Comp.vue', ts.ScriptSnapshot.fromString(source), 'vue')!;
	const script = [...forEachEmbeddedCode(sourceScript.generated!.root)].find(code => /^script_[jt]s$/.test(code.id))!;
	const text = script.snapshot.getText(0, script.snapshot.getLength());
	return {
		text,
		ast: ts.createSourceFile(`/Comp.${script.id.slice('script_'.length)}`, text, ts.ScriptTarget.Latest, true),
		map: language.maps.get(script, sourceScript),
	};
}

function syntaxErrors(ast: ts.SourceFile) {
	return (ast as ts.SourceFile & { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics
		.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
}

// What the generated code holds between the given user text and the end of its line.
function restOfLine(text: string, userText: string) {
	const start = text.indexOf(userText);
	if (start === -1) {
		throw new Error(`${JSON.stringify(userText)} is not in the generated code`);
	}
	const end = start + userText.length;
	return text.slice(end, text.indexOf('\n', end));
}

describe('generated code starts on a new line after user text', () => {
	const cases: [name: string, source: string, userTexts?: string[]][] = [
		[
			'script setup',
			`<script setup lang="ts">const a = 1</script>`,
			['const a = 1'],
		],
		[
			'script setup ending with a macro',
			`<script setup lang="ts">defineProps<{ msg: string }>()</script>`,
		],
		[
			'script setup ending with a line comment',
			`<script setup lang="ts">defineProps<{ msg: string }>() // note</script>`,
			['// note'],
		],
		[
			'script setup ending with a generated cast',
			`<script setup lang="ts">import { useTemplateRef } from 'vue'\nconst el = useTemplateRef('el')</script>`,
		],
		[
			'script setup in JS',
			`<script setup>const model = defineModel() // note</script>`,
			['// note'],
		],
		[
			'script',
			`<script lang="ts">const a = 1</script>`,
			['const a = 1'],
		],
		[
			'script before script setup',
			`<script lang="ts">const a = 1</script><script setup lang="ts">const b = 2</script>`,
			['const a = 1', 'const b = 2'],
		],
		[
			'script with a default export before script setup',
			`<script lang="ts">export default {}\nconst a = 1 // note</script><script setup lang="ts">const b = 2</script>`,
			['// note', 'const b = 2'],
		],
		[
			'import-only script setup',
			`<script setup lang="ts">import a from './a'</script>`,
			[`'./a'`],
		],
		[
			'import-only script setup after script',
			`<script lang="ts">export default {}</script><script setup lang="ts">import a from './a'</script>`,
			[`'./a'`],
		],
		[
			'import-only script setup with generic',
			`<script setup lang="ts" generic="T">import a from './a'</script>`,
			[`'./a'`],
		],
		[
			'leading directive in script setup after script',
			`<script lang="ts">export default {}</script><script setup lang="ts">\n// @ts-nocheck\nconst a = 1\n</script>`,
			['// @ts-nocheck'],
		],
		[
			'leading directive in script setup with generic',
			`<script setup lang="ts" generic="T">\n// @ts-nocheck\nconst a = 1\n</script>`,
			['// @ts-nocheck'],
		],
	];

	test.each(cases)('%s', (_, source, userTexts = []) => {
		const { text, ast } = generate(source);
		expect(syntaxErrors(ast)).toEqual([]);
		for (const userText of userTexts) {
			expect(restOfLine(text, userText)).toBe('');
		}
	});
});

test('user text continuing on the same line is not separated', () => {
	// The missing separator is an error of the source that the generated code has to keep.
	const { text, ast } = generate(
		`<script lang="ts">export default {}</script><script setup lang="ts">import { ref } from 'vue'ref('')\n</script>`,
	);
	expect(restOfLine(text, `'vue'`)).not.toBe('');
	expect(syntaxErrors(ast)).not.toEqual([]);
});

test('a range through the added line break maps to the end of the block', () => {
	const statement = `import { b, a } from './a';`;
	const source = `<script setup lang="ts">${statement}</script>`;
	const { text, map } = generate(source);
	const start = text.indexOf(statement);
	const end = start + statement.length;
	expect(text[end]).toBe('\n');

	// TypeScript replaces or removes a statement together with its line break.
	const ranges = [...map.toSourceRange(start, end + 1, false)];
	expect(ranges.map(([sourceStart, sourceEnd]) => source.slice(sourceStart, sourceEnd))).toEqual([statement]);

	// The end of the block first resolves before the line break, where completions are requested.
	const [location] = map.toGeneratedLocation(source.indexOf('</script>'));
	expect(location?.[0]).toBe(end);
});

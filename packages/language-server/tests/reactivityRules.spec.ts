import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import type { ReactivityAnalysisResult } from '../lib/reactivity';
import { getLanguageServer, testWorkspacePath } from './server';

test.each<[name: string, script: string, cursor: string, expected: { dependencies: string[]; dependents: string[] }]>([
	[
		'the getter of computed options',
		`import { computed, ref, watchEffect } from 'vue';
const count = ref(0);
const plusOne = computed({
	get: () => count.value + 1,
	set: value => {
		count.value = value - 1;
	},
});
watchEffect(() => {
	console.log(plusOne.value);
});
`,
		'plusOne = computed',
		{ dependencies: ['count'], dependents: ['console.log(plusOne.value);'] },
	],
	[
		'a watch source and its callback',
		`import { ref, watch } from 'vue';
const count = ref(0);
watch(count, value => {
	console.log(value);
});
`,
		'count = ref',
		{ dependencies: [], dependents: ['console.log(value);'] },
	],
	[
		'the refs that toRefs destructures',
		`import { computed, reactive, toRefs } from 'vue';
const state = reactive({ a: 1, b: 2 });
const { a, b } = toRefs(state);
const sum = computed(() => a.value + b.value + state.a);
`,
		'sum = computed',
		{ dependencies: ['a', 'b', 'state'], dependents: [] },
	],
	[
		'the signals that a called function reads',
		`import { computed, ref } from 'vue';
const count = ref(0);
function read() {
	return count.value;
}
const viaCall = computed(() => read() * 2);
`,
		'viaCall = computed',
		{ dependencies: ['read', 'return count.value;', 'count'], dependents: [] },
	],
	[
		'only the reads of the declaration in scope',
		`import { computed, ref } from 'vue';
const count = ref(0);
const outer = computed(() => count.value);
function scoped(count: { value: number }) {
	return computed(() => count.value);
}
{
	const count = ref(1);
	const inner = computed(() => count.value);
}
`,
		'count = ref(0)',
		{ dependencies: [], dependents: ['count.value'] },
	],
	[
		'a hoisted var read before its declaration',
		`import { computed, ref } from 'vue';
var early = computed(() => late.value);
var late = ref(0);
`,
		'late = ref',
		{ dependencies: [], dependents: ['late.value'] },
	],
	[
		'element accesses of reactive objects',
		`import { computed, reactive, ref } from 'vue';
const count = ref(0);
const state = reactive({ a: 1 });
const key = 'a';
const total = computed(() => count['value'] + state[key]);
`,
		'total = computed',
		{ dependencies: ['state'], dependents: [] },
	],
	[
		'the reads of a destructured composable result, not of another call of the composable',
		`import { computed, ref } from 'vue';
function useCounter() {
	const n = ref(0);
	return { n };
}
const { n } = useCounter();
const counter = useCounter();
const fromDestructured = computed(() => n.value);
const fromOther = computed(() => counter.n.value);
`,
		'n } = useCounter',
		{ dependencies: [], dependents: ['n.value'] },
	],
	[
		'the reads of a namespace export by its name in the namespace, not by qualified name',
		`import { computed, ref } from 'vue';
namespace NS {
	export const inner = ref(0);
	export const local = computed(() => inner.value);
}
const qualified = computed(() => NS.inner.value);
`,
		'inner = ref',
		{ dependencies: [], dependents: ['inner.value'] },
	],
	[
		'the signals that a called named function expression reads',
		`import { computed, ref } from 'vue';
const count = ref(0);
const fn = function named() {
	return count.value;
};
const viaCall = computed(() => fn() * 2);
`,
		'viaCall = computed',
		{ dependencies: ['fn', 'return count.value;', 'count'], dependents: [] },
	],
])('reactivity analysis follows %s', async (_name, script, cursor, expected) => {
	const server = await getLanguageServer();
	const result = await server.vueserver.connection.sendRequest<ReactivityAnalysisResult | undefined>(
		'vue/reactivityAnalysis',
		{
			textDocument: { uri: URI.file(`${testWorkspacePath}/tsconfigProject/composable.ts`).toString() },
			offset: script.indexOf(cursor),
			content: script,
		},
	);
	expect(
		result && {
			dependencies: result.dependencyRanges.map(({ pos, end }) => script.slice(pos, end)),
			dependents: result.dependentRanges.map(({ pos, end }) => script.slice(pos, end)),
		},
	).toEqual(expected);
});

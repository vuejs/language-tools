<template>
	<!-- function binding: read, should NOT get `.value` -->
	<button @click="handler"></button>
	<div>{{ exactType(handler, {} as (_e: Event) => void) }}</div>

	<!-- ref binding: read -->
	<div>{{ exactType(count, {} as number) }}</div>

	<!-- ref binding: narrowing (v-if) -->
	<div v-if="count">{{ exactType(count, {} as number) }}</div>

	<!-- ref binding: narrowing (ternary) -->
	<div>{{ count ? count : 0 }}</div>

	<!-- ref binding: write (v-model) -->
	<input v-model="count" />

	<!-- type guard: typeof -->
	<div>{{ typeof strOrNum === 'string' && exactType(strOrNum, {} as string) }}</div>

	<!-- type guard: instanceof -->
	<div>{{ dateOrStr instanceof Date && exactType(dateOrStr, {} as Date) }}</div>

	<!-- type guard: in -->
	<div>{{ 'a' in objUnion && exactType(objUnion, {} as { kind: 'a'; a: number }) }}</div>

	<!-- type guard: === -->
	<div>{{ aOrB === 'a' && exactType(aOrB, {} as 'a') }}</div>

	<!-- narrowing loss: v-if + read (ref value narrowed to string) -->
	<div v-if="maybe">{{ exactType(maybe, {} as string) }}</div>

	<!-- narrowing loss: v-if + shorthand prop (prop type does NOT allow undefined) -->
	<Child v-if="maybe" :foo="maybe" />

	<!-- narrowing loss: ternary condition + read -->
	<div>{{ maybe ? exactType(maybe, {} as string) : '' }}</div>

	<!-- narrowing loss: && short-circuit + read -->
	<div>{{ maybe && exactType(maybe, {} as string) }}</div>

	<!-- negation narrowing: v-else (falsy) -->
	<div v-if="flag">{{ exactType(flag, {} as true) }}</div>
	<div v-else>{{ exactType(flag, {} as false) }}</div>

	<!-- negation narrowing: v-else-if (comparison type guard) -->
	<div v-if="aOrB === 'a'">{{ exactType(aOrB, {} as 'a') }}</div>
	<div v-else-if="aOrB === 'b'">{{ exactType(aOrB, {} as 'b') }}</div>

	<!-- negation narrowing: v-else-if (negation of previous v-if, not own condition) -->
	<div v-if="flag">{{ exactType(flag, {} as true) }}</div>
	<div v-else-if="otherFlag">{{ exactType(flag, {} as false) }}</div>

	<!-- && right operand narrowing (regression): b should be narrowed to string -->
	<div>{{ a && b && exactType(b, {} as string) }}</div>

	<!-- withDotValue nullish collapse (non-ref union): v-else should narrow to undefined -->
	<div v-if="maybeFn">{{ exactType(maybeFn, {} as (_e: Event) => void) }}</div>
	<div v-else>{{ exactType(maybeFn, undefined) }}</div>
</template>

<script setup lang="ts">
import { defineComponent, ref } from 'vue';
import { exactType } from '../shared';

function handler(_e: Event) {}
const count = ref(0);
const strOrNum = ref<string | number>('');
const dateOrStr = ref<unknown>(new Date());
const objUnion = ref<{ kind: 'a'; a: number } | { kind: 'b'; b: string }>({ kind: 'a', a: 1 });
const aOrB = ref<'a' | 'b'>('a');
const maybe = ref<string | undefined>('');
const flag = ref<boolean>(true);
const otherFlag = ref<boolean>(true);
const a = ref<string | undefined>('');
const b = ref<string | undefined>('');
const maybeFn: ((_e: Event) => void) | undefined = Math.random() > 0.5 ? (_e: Event) => {} : undefined;
const Child = defineComponent({
	__typeProps: {} as { foo: string },
});
</script>

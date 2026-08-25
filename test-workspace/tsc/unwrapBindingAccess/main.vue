<template>
	<!-- function binding: read, should NOT get `.value` -->
	<button @click="handler"></button>
	<div>{{ exactType(handler, {} as (_e: Event) => void) }}</div>

	<!-- function binding: callee under v-if should stay read (no `.value`) -->
	<div v-if="guard()">{{ exactType(guard, {} as () => boolean) }}</div>

	<!-- constructor binding: `new Foo()` should keep the constructor as a read (no `.value`) -->
	<div v-if="new Foo()">{{ exactType(new Foo(), {} as Foo) }}</div>

	<!-- ref binding: read -->
	<div>{{ exactType(count, {} as number) }}</div>

	<!-- ref binding: narrowing (v-if) -->
	<div v-if="count">{{ exactType(count, {} as number) }}</div>

	<!-- ref binding: narrowing (ternary) -->
	<div>{{ count ? count : 0 }}</div>

	<!-- ref binding: write (v-model) -->
	<input v-model="count" />

	<!-- ref binding: write (increment / decrement) -->
	<button @click="count++" />
	<button @click="++count" />

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

	<!-- narrowing loss: v-if + shorthand prop -->
	<ChildMaybe v-if="maybe" :maybe />

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

	<!-- function declaration: v-if condition must stay a read (no `.value`) -->
	<div v-if="handler"></div>

	<!-- class declaration: v-if condition must stay a read (no `.value`) -->
	<div v-if="Foo"></div>

	<!-- arrow IIFE in a logical condition: inner param must remain untouched -->
	<div v-if="((x) => x)(someRef) && other"></div>

	<!-- destructuring assignment: object write target -->
	<button @click="({ x } = source)" />

	<!-- destructuring assignment: array write target -->
	<button @click="[y] = items" />

	<!-- for-of: bare loop target writes to the setup binding -->
	<button @click="for (item of items) {}" />

	<!-- for-of: declared loop variable is a scoped local -->
	<button @click="for (const it of items) { void it; }" />

	<!-- || right operand narrowing: maybeFn narrows to undefined in v-else -->
	<div v-if="flag || maybeFn"></div>
	<div v-else>{{ exactType(maybeFn, undefined) }}</div>

	<!-- ?? left operand narrowing: maybeFn narrows to undefined in v-else -->
	<div v-if="maybeFn ?? flag"></div>
	<div v-else>{{ exactType(maybeFn, undefined) }}</div>

	<!-- if statement narrowing: maybe narrows to string in the then branch -->
	<button @click="if (maybe) { exactType(maybe, {} as string) }" />

	<!-- while statement narrowing: maybe narrows to string in the body -->
	<button @click="while (maybe) { exactType(maybe, {} as string); break; }" />

	<!-- v-if: RHS-nested condition name narrows into branch children -->
	<div v-if="flag && maybe">{{ exactType(maybe, {} as string) }}</div>

	<!-- do-while: body precedes condition in source order -->
	<button @click="do { void item; } while (flag)" />

	<!-- switch: interleaved case statements + discriminant narrowing into clause bodies -->
	<button @click="switch (aOrB) { case 'a': exactType(aOrB, {} as 'a'); break; case 'b': exactType(aOrB, {} as 'b'); }" />
</template>

<script setup lang="ts">
import { defineComponent, ref } from 'vue';
import { exactType } from '../shared';

function handler(_e: Event) {}
function guard() { return true; }
class Foo {}
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
const someRef = ref(0);
const other = ref(true);
const x = ref(0);
const y = ref(0);
const source = ref({ x: 0 });
const items = ref<[number, number, number]>([1, 2, 3]);
const item = ref(0);
const Child = defineComponent({
	__typeProps: {} as { foo: string },
});
const ChildMaybe = defineComponent({
	__typeProps: {} as { maybe: string },
});
</script>

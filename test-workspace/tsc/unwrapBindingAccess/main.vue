<template>
	<!-- function binding: read, should NOT get `.value` -->
	<button @click="handler"></button>
	<div>{{ exactType(handler, {} as (_e: Event) => void) }}</div>

	<!-- condition callee: the callee is not the narrowed subject (the call result is), so it stays a read -->
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

	<!-- type query on a ref keeps `.value` semantics -->
	<div>{{ exactType(maybe as any as typeof count, {} as number) }}</div>

	<!-- typeof query inside explicit call / new type arguments -->
	<div>{{ exactType(generic<typeof count>(1), {} as number) }}</div>
	<div>{{ exactType(new G<typeof count>(1).v, {} as number) }}</div>

	<!-- function declaration in handler: name + params must not be rewritten -->
	<button @click="function helper(a: number) { return a; } helper(1);" />

	<!-- class expression: heritage + method params -->
	<button @click="const C = class extends Foo { m(a: number) { return a; } }; void C;" />

	<!-- label + break label untouched -->
	<button @click="outer: for (;;) { break outer; }" />

	<!-- computed method name reads the binding -->
	<button @click="void { [key]() { return 1; } }" />

	<!-- catch clause scoping -->
	<button @click="try { handler(null as any); } catch (e) { void e; }" />

	<!-- enum in handler body -->
	<button @click="enum E { A = 1 } void E;" />

	<!-- interface / type alias in handler body (names + members not rewritten) -->
	<button @click="interface I { a: number } type T = typeof count; const i: I = { a: 1 }; let v: T = 1; void i; void v;" />

	<!-- v-for: loop variable shadows the same-named setup binding -->
	<div v-for="num in nums">{{ exactType(num, {} as number) }}</div>
	<div>{{ exactType(num, {} as string) }}</div>

	<!-- v-for: narrowed setup binding shadowed by loop variable inside the branch -->
	<div v-if="maybe"><div v-for="maybe in nums">{{ exactType(maybe, {} as number) }}</div></div>

	<!-- v-for: key/index aliases and destructured patterns shadow same-named bindings -->
	<div v-for="(row, idx) in nums">{{ exactType(row, {} as number) }}{{ exactType(idx, {} as number) }}</div>
	<div>{{ exactType(idx, {} as boolean) }}</div>
	<div v-for="{ val } in objs">{{ exactType(val, {} as string) }}</div>
	<div>{{ exactType(val, {} as number) }}</div>

	<!-- v-for: the source expression is evaluated in the outer scope, even when the loop variable shares its name -->
	<div v-for="entry in entry">{{ exactType(entry, {} as number) }}</div>

	<!-- v-for: an inner loop variable shadows an outer loop variable; the inner source still evaluates in the outer scope -->
	<div v-for="outer in matrix">
		<div v-for="outer in outer">{{ exactType(outer, {} as number) }}</div>
	</div>

	<!-- v-for: loop variable shadows a global identifier; the source still resolves to the global -->
	<div v-for="Array in Array(3)">{{ exactType(Array, {} as any) }}</div>

	<!-- v-for: loop variable shadows an imported component; the source still resolves to the import -->
	<div v-for="Comp in [Comp]">{{ Comp }}</div>

	<!-- class expression: its name does not leak into the surrounding scope -->
	<button @click="const C = class count {}; void C; exactType(count, {} as number)" />

	<!-- for statement: the incrementor runs after the condition, so it is narrowed too (when the body can fall through) -->
	<button @click="for (; maybe; exactType(maybe, {} as string)) { }" />

	<!-- new operand with a comment between `new` and the operand still parenthesizes -->
	<div>{{ exactType(new /* gap */ Foo(), {} as Foo) }}</div>

	<!-- type parameter constraint (typeof query) yields before the parameter initializer -->
	<button @click="function f<T extends typeof count>(x: T = count as T) { return x; } f(2);" />

	<!-- destructuring + type annotation: the pattern's nested reads precede the type query -->
	<button @click="const { z = count }: typeof shape = shape; void z;" />

	<!-- comma operator: the result operand drives narrowing -->
	<div v-if="(guard(), flag)">{{ exactType(flag, {} as true) }}</div>
	<button @click="if ((guard(), flag)) { exactType(flag, {} as true); }" />

	<!-- early exit: return keeps fall-through narrowing -->
	<button @click="if (flag) return; exactType(flag, {} as false);" />
	<button @click="if (!maybe) return; exactType(maybe, {} as string);" />

	<!-- early exit: throw keeps fall-through narrowing -->
	<button @click="if (!maybe) throw new Error(); exactType(maybe, {} as string);" />
	<button @click="try { if (!maybe) throw new Error(); exactType(maybe, {} as string); } catch (e) { void e; }" />

	<!-- early exit: over-broad reads after the guard must still error -->
	<!-- @vue-expect-error -->
	<button @click="if (!maybe) return; exactType(maybe, {} as string | undefined);" />
	<!-- @vue-expect-error -->
	<button @click="if (flag) return; exactType(flag, {} as boolean);" />

	<!-- class field computed name unwraps the ref -->
	<button @click="const C = class { [literalKey] = 1 }; void C;" />

	<!-- binding pattern computed name unwraps the ref -->
	<button @click="const { [literalKey]: bx } = { m: 1 }; void bx;" />

	<!-- bare delete on a ref binding targets `.value` (not optional) -->
	<!-- @vue-expect-error -->
	<button @click="delete count" />

	<!-- plain object binding with a `value` property is not unwrapped -->
	<div>{{ exactType(box, {} as { value: number }) }}</div>

	<!-- v-for: inline literal sources keep their literal types (#6067) -->
	<div v-for="n in [1, 2, 3]">{{ exactType(n, {} as 1 | 2 | 3) }}</div>
	<div v-for="(v, k) in { a: 1, b: 2 }">{{ exactType(v, {} as 1 | 2) }}{{ exactType(k, {} as 'a' | 'b') }}</div>

	<!-- v-for: destructured defaults unwrap ref bindings -->
	<div v-for="{ val = fallback } in objs">{{ exactType(val, {} as string | number) }}</div>
	<div v-for="{ a: { b = fallback } } in nestedOpt">{{ exactType(b, {} as number) }}</div>

	<!-- unions including null/undefined narrow for real when the initializer does not pin the flow type -->
	<div v-if="fnUndef">{{ exactType(fnUndef, {} as () => number) }}</div>
	<div v-else>{{ exactType(fnUndef, undefined) }}</div>
	<div v-if="strUndef">{{ exactType(strUndef, {} as string) }}</div>
	<!-- an empty string is falsy, so `string` survives the else branch -->
	<div v-else>{{ exactType(strUndef, {} as string | undefined) }}</div>
	<div v-if="fnNull">{{ exactType(fnNull, {} as () => number) }}</div>
	<div v-else>{{ exactType(fnNull, null) }}</div>
	<div v-if="numZero">{{ exactType(numZero, {} as 1) }}</div>

	<!-- imported nullish consts are not CFA-pinned across the module boundary
		(TypeScript uses the declared type for imports), so they narrow through
		__VLS_withDotValue like any other declared union -->
	<div v-if="importedUndef">{{ exactType(importedUndef, {} as string) }}</div>
	<div v-else>{{ exactType(importedUndef, {} as string | undefined) }}</div>
	<div v-if="importedNull">{{ exactType(importedNull, {} as () => number) }}</div>
	<div v-else>{{ exactType(importedNull, null) }}</div>
</template>

<script setup lang="ts">
import { defineComponent, ref } from 'vue';
import { exactType } from '../shared';
import { importedNull, importedUndef } from './pinned';
import Comp from './child.vue';

function handler(_e: Event) {}
function guard() { return true; }
function generic<T>(v: T) { return v; }
class Foo {}
class G<T> {
	constructor(readonly v: T) {}
}
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
const shape = ref({ z: 1 });
const items = ref<[number, number, number]>([1, 2, 3]);
const item = ref(0);
const key = ref('m');
const num = ref('');
const nums = ref<number[]>([1, 2]);
const idx = ref(true);
const val = ref(0);
const objs = ref([{ val: 'x' }]);
const entry = ref<number[]>([1, 2]);
const matrix = ref<number[][]>([[1]]);
const literalKey = ref<'m'>('m');
const box = { value: 42 };
const fallback = ref(0);
const nestedOpt = ref([{ a: { b: 1 } as { b?: number } }]);
const fnUndef: (() => number) | undefined = Math.random() > 0.5 ? () => 1 : undefined;
const strUndef: string | undefined = Math.random() > 0.5 ? 'x' : undefined;
const fnNull: (() => number) | null = Math.random() > 0.5 ? () => 1 : null;
const numZero: 0 | 1 = Math.random() > 0.5 ? 0 : 1;
const Child = defineComponent({
	__typeProps: {} as { foo: string },
});
const ChildMaybe = defineComponent({
	__typeProps: {} as { maybe: string },
});
</script>

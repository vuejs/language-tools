<script setup lang="ts">
import { ref } from 'vue';
import { exactType } from '../shared';
import Child from './child.vue';

const foo = ref(1);
const bar = 2;
type Foo<T> = { value?: T };
</script>

<template>
	<Child v-slot="{ a }: { a: typeof foo }">{{ exactType(a, {} as typeof foo) }}{{ exactType(a, {} as number) }}</Child>
	<Child v-slot="x: Foo<typeof bar>">{{ exactType(x, {} as Foo<typeof bar>) }}{{ exactType(x, {} as Foo<2>) }}</Child>
	<Child v-slot="{ b = foo }: { b?: number }">{{ exactType(b, {} as number) }}</Child>
</template>

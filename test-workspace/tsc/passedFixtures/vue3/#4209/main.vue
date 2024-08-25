<script setup lang="ts">
type Bar = {
	id: string;
} | null;

type Example = {
	foo: {
		bar: Bar;
	};
	doSomething(id: string): void;
};
const example: Example = {
	foo: {
		bar: {
			id: '123',
		},
	},
	doSomething(id: string) {
		console.log(id);
	},
};
</script>

<template>
	<button
		v-if="example.foo.bar"
		type="button"
		v-on:click="example.doSomething(example.foo.bar.id)"
	>
		{{ example.foo.bar.id }}
	</button>
</template>

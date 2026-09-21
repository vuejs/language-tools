<script setup lang="ts">
import { defineComponent } from 'vue';

const Comp = defineComponent({});
const [foo, bar, baz, qux] = {} as number[];

let a = 0;
let b = 0;
</script>

<template>
	<!-- @vue-ignore -->
	<template v-if="a" :foo />
	<!-- @vue-ignore -->
	<template v-else-if="b" :bar />
	<Comp>
		<template #default v-if="baz" />
		<template #default v-else-if="qux" />
	</Comp>
</template>

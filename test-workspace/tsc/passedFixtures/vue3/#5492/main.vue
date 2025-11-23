<script setup lang="ts">
import { defineComponent } from 'vue';

const Comp = defineComponent({});
const [foo, bar, baz, qux] = {} as any[];
</script>

<template>
	<template v-if="(true as any)" :foo />
	<template v-else-if="(false as any)" :bar />

	<Comp>
		<template #default v-if="baz" />
		<template #default v-else-if="qux" />
	</Comp>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

const Comp = defineComponent({});
const [foo, bar, baz, qux] = {} as number[];
</script>

<template>
	<template v-if="true" :foo />
	<template v-else-if="false" :bar />
	<Comp>
		<template #default v-if="baz" />
		<template #default v-else-if="qux" />
	</Comp>
</template>

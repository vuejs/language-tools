<script setup lang="ts" generic="R extends import('vue').Ref<number, string> | string">
const props = defineProps<{ count: R }>();
const count = props.count;
</script>

<template>
	<button @click="() => { if (typeof count === 'number') count = '3'; }" />
	<!-- @vue-expect-error -->
	<button @click="() => { if (typeof count === 'number') count = 3; }" />
	<!-- @vue-expect-error -->
	<button @click="() => { if (typeof count === 'number') count = true; }" />
</template>

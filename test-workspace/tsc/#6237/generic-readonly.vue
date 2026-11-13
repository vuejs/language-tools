<script setup lang="ts" generic="R extends import('vue').ComputedRef<number> | string">
const props = defineProps<{ count: R }>();
const count = props.count;
</script>

<template>
	<!-- @vue-expect-error -->
	<button @click="() => { if (typeof count === 'number') count = 3; }" />
</template>

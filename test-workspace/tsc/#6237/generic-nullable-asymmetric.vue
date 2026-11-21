<script setup lang="ts" generic="R extends import('vue').Ref<number, string> | null">
const props = defineProps<{ count: R }>();
const count = props.count;
</script>

<template>
	<button @click="() => { if (count !== null) count = '3'; }" />
	<!-- @vue-expect-error -->
	<button @click="() => { if (count !== null) count = 3; }" />
</template>

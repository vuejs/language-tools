<script setup lang="ts" generic="R extends import('vue').Ref<number, string>">
const props = defineProps<{ count: R }>();
const count = props.count;
</script>

<template>
	<button @click="() => { count = '3'; }" />
	<!-- @vue-expect-error -->
	<button @click="() => { count = 3; }" />
</template>

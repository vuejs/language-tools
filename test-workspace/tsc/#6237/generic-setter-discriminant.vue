<script setup lang="ts" generic="T extends import('vue').Ref<1, string> | import('vue').Ref<2, Date>">
const props = defineProps<{ count: T }>();
const count = props.count;
</script>

<template>
	<button @click="() => { if (count === 1) count = 'hello'; }" />
	<button @click="() => { if (count === 2) count = new Date(); }" />
	<!-- @vue-expect-error -->
	<button @click="() => { if (count === 1) count = new Date(); }" />
	<!-- @vue-expect-error -->
	<button @click="() => { if (count === 2) count = 'hello'; }" />
</template>

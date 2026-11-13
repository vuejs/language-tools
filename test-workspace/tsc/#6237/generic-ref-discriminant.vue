<script setup lang="ts" generic="T extends import('vue').ComputedRef<1> | import('vue').Ref<2, string>">
const props = defineProps<{ count: T }>();
const count = props.count;
</script>

<template>
	<button @click="() => { if (count === 2) count = 'hello'; }" />
	<!-- @vue-expect-error -->
	<button @click="() => { if (count === 1) count = 1; }" />
</template>

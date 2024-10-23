<script setup lang="ts" generic="const T">
const { foo } = defineProps<{
	foo: T;
}>();

defineExpose({
	foo,
});
</script>

<template>
	<div />
</template>

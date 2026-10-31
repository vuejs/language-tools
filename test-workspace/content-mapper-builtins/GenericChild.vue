<script setup lang="ts" generic="T">
const props = defineProps<{ items: T[] }>();
const emit = defineEmits<{ select: [item: T] }>();
const selected = defineModel<T>('selected');
defineSlots<{ default(props: { item: T }): any }>();
defineExpose({ size: () => props.items.length });
</script>

<template>
	<div v-for="item in items" @click="emit('select', item), selected = item">
		<slot :item="item" />
	</div>
</template>

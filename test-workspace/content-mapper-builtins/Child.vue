<script setup lang="ts">
const props = withDefaults(defineProps<{ label?: string; count: number }>(), { label: 'label' });
const emit = defineEmits<{ change: [value: number] }>();
const model = defineModel<string>();
defineSlots<{ default(props: { item: number }): any; footer(): any }>();

function onClick() {
	emit('change', props.count);
	model.value = props.label;
}
</script>

<template>
	<button @click="onClick">{{ label }} {{ count }} {{ model }}</button>
	<slot :item="count" />
	<slot name="footer" />
	<span>{{ $slots.default }} {{ $props.label }} {{ $attrs.id }}</span>
</template>

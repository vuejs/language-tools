<script setup lang="ts" generic="T">
import type { PropType } from 'vue';

defineProps({
	value: { type: null as unknown as PropType<T>, required: true },
	onSubmit: { type: Function as PropType<(value: T) => void>, required: true },
});
</script>

<template>
	<div />
</template>

<template>
	<button @click="emit('foo')">{{ store.items }}</button>
</template>
<script lang="ts">
export const name = 'runtime-emits';
</script>
<script setup lang="ts">
import { useRuntimeEmitsStore } from './runtime-emits-store';

const emit = defineEmits(['foo']);
const store = useRuntimeEmitsStore();
</script>

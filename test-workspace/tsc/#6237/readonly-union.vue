<script setup lang="ts">
import type { ComputedRef } from 'vue';

const props = defineProps<{ value: ComputedRef<1> | 'a' | 'b' }>();
const value = props.value;
</script>

<template>
	<button @click="() => { if (value === 'a') value = 'b'; }" />
	<!-- @vue-expect-error -->
	<button @click="() => { if (value === 1) value = 1; }" />
</template>

<script setup lang="ts">
import type { WritableComputedRef } from 'vue';

const props = defineProps<{ count: WritableComputedRef<number, string> | null }>();
const count = props.count;
</script>

<template>
	<button @click="() => { if (count !== null) count = '3'; }" />
	<!-- @vue-expect-error -->
	<button @click="() => { if (count !== null) count = 3; }" />
</template>

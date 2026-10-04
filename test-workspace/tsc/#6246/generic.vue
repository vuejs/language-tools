<template>
	<div>{{ store.items }}</div>
</template>
<script setup lang="ts" generic="T">
import { useGenericStore } from './generic-store';

defineProps<{ item: T }>();

const store = useGenericStore();
defineExpose({ store });
</script>

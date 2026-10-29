<script setup lang="ts">
import { useStore } from './useStore';

const store = useStore();
</script>

<template>
	<div>{{ store.items }}</div>
</template>

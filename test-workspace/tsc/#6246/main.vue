<template>
	<div>{{ store.items }}</div>
</template>
<script setup lang="ts">
import { useStore } from './store';

const store = useStore();
</script>

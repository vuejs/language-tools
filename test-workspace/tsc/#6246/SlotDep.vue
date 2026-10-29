<script setup lang="ts">
import { useStore } from './useStore';
const store = useStore();
</script>
<template>
	<div><slot :items="store.items" /></div>
</template>

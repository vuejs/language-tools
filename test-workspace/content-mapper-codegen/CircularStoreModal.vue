<script setup lang="ts">
import { useCircularStore } from './circularStore';

const store = useCircularStore();
</script>

<template>
	<div>{{ store.items }}</div>
	<slot :items="store.items" />
</template>

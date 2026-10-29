<script setup lang="ts">
import { useStore } from './useStore';
const store = useStore();
</script>
<template>
	<div>{{ store.items }}<slot name="foo" :n="1" /></div>
</template>

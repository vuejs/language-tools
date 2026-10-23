<!-- @checkRequiredFallthroughAttributes true -->
<script setup lang="ts">
import Child from './generic.vue';
import { exactType } from '../shared';
</script>

<template>
	<Child foo="https://example.com" :check="value => exactType(value, 'https://example.com' as const)" />
</template>

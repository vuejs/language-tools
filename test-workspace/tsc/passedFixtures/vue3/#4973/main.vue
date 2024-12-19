<script setup lang="ts">
import Comp from './comp.vue';

let condition!: 'A' | 'B';
</script>

<template>
	<div v-if="condition === 'A'"></div>
	<Comp v-else :condition />
</template>

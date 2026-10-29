<script setup lang="ts">
import type { MaybeRef } from 'vue';
declare function getValue(): MaybeRef<string | undefined>;
const maybe = getValue();
</script>

<template>
	<div v-if="maybe">{{ maybe.toUpperCase() }}</div>
</template>

<script setup lang="ts">
import child from './child.vue';
import { filter } from './filter';
</script>

<template>
	<child :options="[1, 2]" :filter="filter" />
</template>

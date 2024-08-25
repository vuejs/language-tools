<script setup lang="ts" generic="T">
import { exactType } from '../../shared';

const props = withDefaults(defineProps<{
	value?: T | null;
	list?: T[];
}>(), {
	value: null,
});
</script>

<template>
	<div v-for="item of list">
		{{ exactType(item, {} as T) }}
	</div>
	<div v-for="item of props.list">
		{{ exactType(item, {} as T) }}
	</div>
	<div v-for="item of $props.list">
		{{ exactType(item, {} as T) }}
	</div>
</templat>
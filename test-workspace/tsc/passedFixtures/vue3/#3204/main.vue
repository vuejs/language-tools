<script setup lang="ts" generic="T extends { foo: number }">
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
		{{ exactType(item.foo, {} as number) }}
	</div>
	<div v-for="item of props.list">
		{{ exactType(item.foo, {} as number) }}
	</div>
	<div v-for="item of $props.list">
		{{ exactType(item.foo, {} as number) }}
	</div>
</template>

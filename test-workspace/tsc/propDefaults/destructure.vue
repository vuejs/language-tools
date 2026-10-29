<script setup lang="ts">
const { a = 1, 'foo-bar': fooBar = 'x', c: renamed = [3], d } = defineProps<{
	a?: number;
	'foo-bar'?: string;
	c?: number[];
	d?: number;
}>();
</script>

<template>
	{{ a }}{{ fooBar }}{{ renamed }}{{ d }}
</template>

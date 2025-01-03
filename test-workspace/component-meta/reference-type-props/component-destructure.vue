<script lang="ts" setup>
const {
	text = 'foobar'
} = defineProps<{
	text: string;
}>();
</script>

<template>
	<div>{{ text }}</div>
</template>

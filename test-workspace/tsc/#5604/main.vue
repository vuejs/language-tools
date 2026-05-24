<script lang="ts">
export default {
	beforeRouteEnter() {
		// @ts-expect-error
		console.log('counter', counter);
	},
};
</script>

<script setup lang="ts">
const counter = 1;
</script>

<template>
	{{ counter }}
</template>

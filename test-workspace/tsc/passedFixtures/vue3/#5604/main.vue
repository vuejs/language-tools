<script lang="ts">
export default {
	mounted() {
		// @ts-expect-error
		console.log(counter);
	}
}
</script>

<script setup lang="ts">
const counter = 1;
</script>

<template>
	counter value: {{ counter }}
</template>

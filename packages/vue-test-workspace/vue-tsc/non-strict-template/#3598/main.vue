<script setup lang="ts">
defineProps([]);
</script>

<script lang="ts">
export default {
	data(): { product?: string } {
		return {
			product: undefined,
		};
	},
};
</script>

<template>
	{{ product }}
</template>

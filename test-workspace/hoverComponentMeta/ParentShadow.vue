<script setup lang="ts">
import { defineComponent } from 'vue';

const GlobalChild = defineComponent({
	props: {
		/** The shadowing label */
		label: { type: String, default: 'shadow' },
	},
});
</script>

<template>
	<GlobalChild />
</template>

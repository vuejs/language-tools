<script setup lang="ts">
import { defineComponent } from 'vue';

const Local = defineComponent({
	props: {
		/** The local label */
		label: { type: String, default: 'local' },
	},
	emits: ['change'],
});
</script>

<template>
	<Local />
</template>

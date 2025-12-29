<script lang="ts">
/**
 * My awesome component description
 */
export default {
	name: 'MyComponent',
	props: {
		/**
		 * The title prop
		 */
		title: {
			type: String,
			required: true,
		},
	},
};
</script>

<template>
	<div>{{ title }}</div>
</template>

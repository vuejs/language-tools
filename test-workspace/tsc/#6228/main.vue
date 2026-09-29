<script setup lang="ts">
import Child from './Child.vue';
</script>

<template>
	<Child
		:foo="
			// a comment
			'x'
		"
	/>
	<!-- @vue-expect-error -->
	<Child
		:foo="
			// a comment
			1
		"
	/>
</template>

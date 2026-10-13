<script setup lang="ts">
import Child from './child.vue';

const url = 'a/b';
</script>

<template>
	<Child foo="https://example.com/a/b" />
	<Child :foo="`https://example.com/${url}/100`" />
	<Child :foo="`${/[//]/.source}/${`https://example.com/${url}`}`" />
	<Child
		:foo="
			/* https://example.com/comment */
			'https://example.com/a/b' // trailing comment with */
		"
	/>
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

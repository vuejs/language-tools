<script setup lang="ts">
import Child from './child.vue';

const ids = ['a/b'];
</script>

<template>
	<template v-for="id in ids" :key="id">
		<Child foo="https://example.com" />
		<Child foo="https://example.com/*/" />
		<Child :foo="'https://example.com'" />
		<Child :foo="`https://example.com/${id}`" />
		<Child :foo="/[//]/.source" />
		<Child :foo="/* https://example.com */ id" />
		<Child v-bind="{ foo: 'https://example.com' }" />
		<Child
			:foo="
				// https://example.com
				id
			"
		/>
		{{ id }}
	</template>
	<!-- @vue-expect-error -->
	<Child :key="'https://example.com'" :foo="1" />
</template>

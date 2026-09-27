<template>
	<HelloWorld
		:multiple="
			// a line comment inside a multi-line expression
			true
		"
		:modelValue="['a']"
	/>
	<!-- @vue-expect-error -->
	<HelloWorld
		:multiple="
			// a line comment inside a multi-line expression
			true
		"
		:modelValue="'a'"
	/>
</template>

<script lang="ts" setup>
import HelloWorld from './component.vue';
</script>

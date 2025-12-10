<template>
	<!-- @vue-expect-error -->
	<Foo bar="123"></Foo>

	<!-- @vue-expect-error -->
	<div foo="123"></div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

const Foo = defineComponent({
	props: {
		foo: String
	}
});
</script>

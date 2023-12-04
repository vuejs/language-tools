<template>
	<Foo stroke-width="test" />
	<component :is="Foo" stroke-width="test"></component>
	<component :is="Foo" strokeWidth="test"></component>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

const Foo = defineComponent({
	props: {
		strokeWidth: { type: String, required: true },
	},
});
</script>

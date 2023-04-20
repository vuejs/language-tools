<template>
	<Foo bar="123"></Foo>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

const Foo = defineComponent({
	props: {
		foo: String
	}
});
</script>

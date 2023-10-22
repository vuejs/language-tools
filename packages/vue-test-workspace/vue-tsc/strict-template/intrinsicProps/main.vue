<template>
	<Foo class="123"></Foo>

	<div class="123"></div>
</template>

<script setup lang="ts">
import { defineComponent } from 'vue';

const Foo = defineComponent({
	props: {
		foo: String
	}
});
</script>

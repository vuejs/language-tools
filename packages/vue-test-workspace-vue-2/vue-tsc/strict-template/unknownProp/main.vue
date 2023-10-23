<template>
	<div>
		<!-- @vue-expect-error -->
		<Foo bar="123"></Foo>

		<!-- @vue-expect-error -->
		<div foo="123"></div>
	</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

const Foo = defineComponent({
	props: {
		foo: String
	}
});
</script>
<script setup lang="ts">
</script>

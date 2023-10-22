<template>
	<div>
		<!-- FIXME: bug here -->
		<!-- @vue-expect-error -->
		<Foo class="123"></Foo>
		<div class="123"></div>
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

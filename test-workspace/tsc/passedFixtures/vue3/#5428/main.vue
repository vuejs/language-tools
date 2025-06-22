<script setup lang="ts">
let foo!: {
	bar?: {
		baz: () => void;
	}
};
const Comp = () => {};
</script>

<template>
	<div v-if="foo.bar">
		<Comp @click="foo.bar.baz" />
	</div>
</template>

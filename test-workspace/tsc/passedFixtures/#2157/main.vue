<script setup lang="ts">
declare module 'vue' {
	export interface GlobalComponents {
		Foo: typeof import('vue')['Transition'];
	}
};
</script>

<template>
	<Foo enter-active-class="" />
</template>

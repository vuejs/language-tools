<script lang="ts" setup>
import { ref } from 'vue';
import Comp from './Comp.vue';
const n = ref(0)
</script>

<template>
	<!-- component with error -->
	<Comp :n="nx" />
	<!-- @vue-expect-error -->
	<Comp :n="nx" />

	<!-- div without error -->
	<div :data-n="n" />
	<!-- @vue-expect-error | expect prompt Unused `@ts-expected-error` directive -->
	<div :data-n="n" />

	<!-- component without error -->
	<Comp :n="n" />
	<!-- @vue-expect-error | expect prompt Unused `@ts-expected-error` directive -->
	<Comp :n="n" />
</template>

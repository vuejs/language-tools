<script lang="ts" setup>
import Comp from './Comp.vue';
</script>

<template>
	<!-- @vue-expect-error -->
	<Comp :str="1" />

	<!-- @vue-expect-error -->
	<div :str="str" />

	<!-- @vue-expect-error | expect prompt Unused `@ts-expected-error` directive -->
	<Comp str="str" />
</template>

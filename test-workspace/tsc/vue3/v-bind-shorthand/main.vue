<script setup lang="ts">
import Comp from './Comp.vue';

const foo = 1;
const bar = '';
</script>

<template>
	<Comp :foo></Comp>
	<!-- @vue-expect-error should typecheck -->
	<Comp :bar></Comp>
	<Comp :bar="1"></Comp>
</template>
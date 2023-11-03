<script setup lang="ts">
import Comp from './Comp.vue';

const foo = 1;
const bar = 1;
</script>

<template>
	<Comp :foo></Comp>
	<!-- @vue-expect-error should typecheck -->
	<Comp :bar></Comp>
</template>
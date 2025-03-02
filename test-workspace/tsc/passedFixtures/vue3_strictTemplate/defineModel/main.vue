<script setup lang="ts">
import Comp from './comp.vue';

let foo!: number;
let bar!: number | undefined;
</script>

<template>
	<!-- @vue-expect-error -->
	<Comp :bar="0" v-model:foo="foo" />
	<Comp v-if="bar" v-model:bar="bar" />
</template>

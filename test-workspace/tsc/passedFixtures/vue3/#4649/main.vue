<script lang="ts" setup>
import Comp from './comp.vue';

const model = '1';
const foo = '1';
const bar = '1';
</script>

<template>
	<!-- @vue-expect-error -->
	<Comp v-model="model" />
	<!-- @vue-expect-error -->
	<Comp v-model:foo="foo" />
	<!-- @vue-expect-error -->
	<Comp v-model:bar="bar" />
</template>

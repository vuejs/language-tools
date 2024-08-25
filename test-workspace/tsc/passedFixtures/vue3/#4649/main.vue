<script lang="ts" setup>
import ModelComp from './model-comp.vue';
import PropComp from './prop-comp.vue';

const model = '1';
const foo = '1';
const bar = '1';
const baz = '1';
</script>

<template>
	<!-- @vue-expect-error -->
	<ModelComp v-model="model" />
	<!-- @vue-expect-error -->
	<ModelComp v-model:foo="foo" />
	<!-- @vue-expect-error -->
	<ModelComp v-model:bar="bar" />
	<!-- @vue-expect-error -->
	<PropComp :foo="foo" />
	<!-- @vue-expect-error -->
	<PropComp :bar="bar" />
	<!-- @vue-expect-error -->
	<PropComp :baz="baz" />
</template>

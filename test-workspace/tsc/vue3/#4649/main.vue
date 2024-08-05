<script lang="ts" setup>
import ModelComp from './model-comp.vue';
import PropComp from './prop-comp.vue';

const model = '1';
const foo = '1';
const bar = '1';
const baz = '1';
</script>

<template>
    <ModelComp v-model="model"/>
	<ModelComp v-model:foo="foo"/>
	<ModelComp v-model:bar="bar"/>
	<PropComp :foo="foo"/>
	<PropComp :bar="bar"/>
	<PropComp :baz="baz"/>
</template>
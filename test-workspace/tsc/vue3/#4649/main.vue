<script lang="ts" setup>
import Child from './component.vue';

const model = '1';
const foo = '1';
const bar = '1';
</script>

<template>
    <Child v-model="model"/>
	<Child v-model:foo="foo"/>
	<Child v-model:bar="bar"/>
</template>
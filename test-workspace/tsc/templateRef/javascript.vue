<script setup>
// @ts-check
import { useTemplateRef } from 'vue';
import Child from './generic.vue';

const child = useTemplateRef('child');
child.value?.foo.toFixed();
// @ts-expect-error
child.value?.missing;

const children = useTemplateRef('children');
children.value?.[0]?.foo.toFixed();
// @ts-expect-error
children.value?.[0]?.missing;
</script>

<template>
	<Child v-if="Math.random() > 0.5" ref="child" :foo="1" />
	<Child v-for="foo in [1, 2]" :key="foo" ref="children" :foo="foo" />
</template>

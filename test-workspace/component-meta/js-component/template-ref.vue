<script setup>
// @ts-check
import { useTemplateRef } from 'vue';
import Child from './component.vue';

const child = useTemplateRef('child');
defineExpose({ child });
</script>

<template>
	<Child v-if="Math.random() > 0.5" ref="child" foo="example" />
</template>

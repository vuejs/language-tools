<script setup>
import { ref } from 'vue';
import { exactType } from '../shared';
import Child from './child.vue';

const count = ref(0);
const text = ref('');
</script>

<template>
	<Child @foo="exactType($event, undefined); count++" />
	<Child @bar="exactType($event, /** @type {number} */ (0)); count++" />
	<Child v-model:a="text" />
	<!-- the JSDoc typing the property fails to parse for a non-identifier name, or to resolve an unknown emit -->
	<Child @update:a="exactType($event, /** @type {any} */ (0)); text = $event" />
	<Child @custom-event="exactType($event, /** @type {any} */ (0)); count++" />
	<div @click="exactType($event, /** @type {PointerEvent} */ (/** @type {unknown} */ (0))); count++" />
</template>

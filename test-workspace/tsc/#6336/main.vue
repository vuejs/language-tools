<script setup lang="ts" generic="T extends 'a' | 'b'">
import { computed } from 'vue';

const props = defineProps<{
	attrs: T extends 'a' ? { title?: string } : { hidden?: boolean };
}>();
const attrs = computed(() => props.attrs);
</script>

<template>
	<div id="foo" v-bind="attrs" />
</template>

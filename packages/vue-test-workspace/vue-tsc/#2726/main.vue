<!-- TODO: This problem only happens when strictTemplates is enabled -->

<script lang="ts" setup>
import { ref } from 'vue';

const foo = ref('bar');

defineSlots<{
	default: {
		foo: string;
		buz?: number;
	};
}>();
</script>

<template>
	<slot v-bind="{ foo: foo }" />
</template>

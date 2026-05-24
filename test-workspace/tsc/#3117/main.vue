<script lang="ts" setup>
import { ref } from 'vue';

const foo = ref('bar');

defineSlots<{
	default: {
		foo: string;
	};
}>();
</script>

<template>
	<div>
		<slot v-bind="{ foo }" />
	</div>
</template>

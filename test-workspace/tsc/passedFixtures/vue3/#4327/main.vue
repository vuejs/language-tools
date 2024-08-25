<script setup lang="ts">
import { ObjectDirective } from 'vue';

const vTest: ObjectDirective<HTMLElement, any | undefined> = {
	mounted() { },
};

defineSlots<{
	default(): any;
}>();
</script>

<template>
	<slot>
		<p v-test="{}">Default slot content</p>
	</slot>
</template>

<script setup lang="ts">
import { ref } from 'vue';

declare const Comp: (props: {}, ctx: { slots: {
	default: (props: { foo: number }) => void;
} }) => {};

const bar = ref(0);
</script>

<template>
	<Comp v-slot="{ foo = bar + 1 }">
		{{ foo }}
	</Comp>
</template>

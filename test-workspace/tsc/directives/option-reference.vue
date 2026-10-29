<script lang="ts">
import type { FunctionDirective } from 'vue';

let Comp!: (_: { foo?: string; }) => void;

const directives = {
	referencedDir: {} as FunctionDirective<typeof Comp, string>,
};

export default {
	directives,
};
</script>

<script setup lang="ts">
</script>

<template>
	<Comp v-referenced-dir="'a'" />
	<!-- @vue-expect-error -->
	<Comp v-referenced-dir="1" />
</template>

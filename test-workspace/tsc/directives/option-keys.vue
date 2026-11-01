<script lang="ts">
import type { FunctionDirective } from 'vue';

let Comp!: (_: { foo?: string; }) => void;

const spread = {
	spreadDir: {} as FunctionDirective<typeof Comp, number>,
};

export default {
	directives: {
		'kebab-dir': {} as FunctionDirective<typeof Comp, string>,
		PascalDir: {} as FunctionDirective<typeof Comp, boolean>,
		...spread,
	},
};
</script>

<script setup lang="ts">
</script>

<template>
	<Comp v-kebab-dir="'a'" />
	<!-- @vue-expect-error -->
	<Comp v-kebab-dir="1" />
	<Comp v-pascal-dir="true" />
	<!-- @vue-expect-error -->
	<Comp v-pascal-dir="1" />
	<Comp v-spread-dir="1" />
	<!-- @vue-expect-error -->
	<Comp v-spread-dir="'a'" />
</template>

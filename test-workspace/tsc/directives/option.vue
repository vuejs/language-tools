<script lang="ts">
import type { FunctionDirective } from 'vue';
import { exactType } from '../shared';

let Comp!: (_: { foo?: string; }) => void;

export default {
	directives: {
		foo: {} as FunctionDirective<typeof Comp, (_: string) => void>
	}
};
</script>

<script setup lang="ts">
// Expose the script bindings to the template.
</script>

<template>
	<Comp v-foo="v => exactType(v, {} as string)" />
</template>

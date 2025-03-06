<script lang="ts">
import type { FunctionDirective } from 'vue';
import { exactType } from '../../shared';

let Comp!: (_: { foo?: string; }) => void;

export default {
	directives: {
		vFoo: {} as FunctionDirective<typeof Comp, (_: string) => void>
	}
};
</script>

<script setup lang="ts">
</script>

<template>
	<Comp v-foo="v => exactType(v, {} as string)" />
</template>

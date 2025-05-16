<script lang="ts">
import type { FunctionDirective } from 'vue';
import { exactType } from '../../shared';

export default {
	directives: {
		foo: {} as FunctionDirective<typeof Comp, (_: string) => void>
	}
};
</script>

<script setup lang="ts">
let Comp!: (_: { foo?: string; }) => void;
</script>

<template>
	<Comp v-foo="v => exactType(v, {} as string)" />
</template>

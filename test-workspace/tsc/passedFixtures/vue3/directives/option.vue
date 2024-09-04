<script lang="ts">
import { FunctionDirective } from 'vue';
import { exactType } from '../../shared';

let Comp!: (_: { foo?: string; }) => void;

export default {
	directives: {
		vBaz: {} as FunctionDirective<typeof Comp, (_: string) => void>
	}
};
</script>

<script setup lang="ts">
</script>

<template>
	<Comp v-baz="v => exactType(v, {} as string)" />
</template>

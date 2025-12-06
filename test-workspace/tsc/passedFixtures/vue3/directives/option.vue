<script lang="ts">
declare function Comp(props: { foo?: string; }): void;

export default {
	directives: {
		foo: {} as FunctionDirective<typeof Comp, (_: string) => void>
	}
};
</script>

<script setup lang="ts">
import type { FunctionDirective } from 'vue';
import { exactType } from '../../shared';
</script>

<template>
	<Comp v-foo="v => exactType(v, {} as string)" />
</template>

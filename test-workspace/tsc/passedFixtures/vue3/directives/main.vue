<script setup lang="ts">
import type { FunctionDirective } from 'vue';
import { exactType } from '../../shared';

declare module 'vue' {
	interface GlobalDirectives {
		vGlobal: FunctionDirective<typeof Comp, (_: number) => void>;
	}
}

let Comp!: (_: { foo?: string; }) => void;

let vLocal!: FunctionDirective<typeof Comp, (_: boolean) => void>;
</script>

<template>
	<Comp v-global="v => exactType(v, {} as number)" />
	<Comp v-local="v => exactType(v, {} as boolean)" />
</template>

<script lang="ts">
import { FunctionDirective } from 'vue';
import { exactType } from '../../shared';

declare module 'vue' {
	interface GlobalDirectives {
		vFoo: FunctionDirective<typeof Comp, (_: number) => void>;
	}
}

let Comp!: (_: { foo?: string; }) => void;

export default {
	directives: {
		vBar: {} as FunctionDirective<typeof Comp, (_: string) => void>
	}
};
</script>

<script setup lang="ts">
let vBaz!: FunctionDirective<typeof Comp, (_: boolean) => void>;
</script>

<template>
	<Comp v-foo="v => exactType(v, {} as number)" />
	<Comp v-bar="v => exactType(v, {} as string)" />
	<Comp v-baz="v => exactType(v, {} as boolean)" />
</template>

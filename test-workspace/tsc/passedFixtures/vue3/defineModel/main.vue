<script setup lang="ts">
import { defineComponent } from 'vue';
import { exactType } from '../../shared';
import ScriptSetup from './script-setup.vue';

const ScriptSetupExact = defineComponent({
	__typeProps: {} as {
		modelValue?: string,
		'c': number,
		'd'?: number,
		'e': string,
		'f'?: string,
		'g'?: string,
	},
	__typeEmits: {} as {
		'update:modelValue': [modelValue: string | undefined];
		'update:c': [c: number];
		'update:d': [d: number | undefined];
		'update:e': [e: string];
		'update:f': [f: string | undefined];
		'update:g': [g: string | undefined];
	},
	setup() {
		return {};
	},
});

exactType(ScriptSetup, ScriptSetupExact);
</script>

<template>
	<ScriptSetup
		:c="0"
		e=""
		@update:model-value="(x) => exactType(x, {} as string | undefined)"
		@update:c="(x) => exactType(x, {} as number)"
		@update:d="(x) => exactType(x, {} as number | undefined)"
		@update:e="(x) => exactType(x, {} as string)"
		@update:f="(x) => exactType(x, {} as string | undefined)"
		@update:g="(x) => exactType(x, {} as string | undefined)"
	/>
</template>

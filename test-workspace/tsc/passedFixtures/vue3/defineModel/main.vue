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
		gModifiers?: Partial<Record<'foo', true>>,
	},
	__typeEmits: {} as {
		'update:modelValue': [modelValue:string];
		'update:c': [c:number];
		'update:d': [d:number];
		'update:e': [e:string];
		'update:f': [f:string];
		'update:g': [g:string];
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
		@update:model-value="(x) => exactType(x, {} as string)"
		@update:c="(x) => exactType(x, {} as number)"
		@update:d="(x) => exactType(x, {} as number)"
		@update:e="(x) => exactType(x, {} as string)"
		@update:f="(x) => exactType(x, {} as string)"
		@update:g="(x) => exactType(x, {} as string)"
	/>
</template>

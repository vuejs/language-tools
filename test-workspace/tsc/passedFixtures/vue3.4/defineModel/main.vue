<script setup lang="ts">
import { exactType } from '../../shared';
import { defineComponent, PropType } from 'vue';
import ScriptSetup from './script-setup.vue';

const ScriptSetupExact = defineComponent({
	props: {} as {
		modelValue: PropType<string>;
		c: { type: PropType<number>, required: true };
		d: PropType<number>;
		e: PropType<string>;
		f: { type: PropType<string>, required: true };
		g: PropType<string>;
	},
	emits: {} as {
		"update:modelValue": (_:string) => void
		"update:c": (_:number) => void
		"update:d": (_:number) => void
		"update:e": (_:string) => void
		"update:f": (_:string) => void
		"update:g": (_:string) => void
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
		f=""
		@update:model-value="(x) => exactType(x, {} as string)"
		@update:c="(x) => exactType(x, {} as number)"
		@update:d="(x) => exactType(x, {} as number)"
		@update:e="(x) => exactType(x, {} as string)"
		@update:f="(x) => exactType(x, {} as string)"
		@update:g="(x) => exactType(x, {} as string)"
	/>
</template>

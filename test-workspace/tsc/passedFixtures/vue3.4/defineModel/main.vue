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
		"update:modelValue": (_: string | undefined) => void
		"update:c": (_: number) => void
		"update:d": (_: number | undefined) => void
		"update:e": (_: string | undefined) => void
		"update:f": (_: string) => void
		"update:g": (_: string | undefined) => void
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
		@update:model-value="(x) => exactType(x, {} as string | undefined)"
		@update:c="(x) => exactType(x, {} as number)"
		@update:d="(x) => exactType(x, {} as number | undefined)"
		@update:e="(x) => exactType(x, {} as string | undefined)"
		@update:f="(x) => exactType(x, {} as string)"
		@update:g="(x) => exactType(x, {} as string | undefined)"
	/>
</template>

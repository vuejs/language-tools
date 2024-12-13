<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { exactType } from '../../shared';
import TemplateRef from './template-ref.vue';

function Comp() {
	const foo = useTemplateRef('templateRef');
	exactType(foo.value, {} as unknown);
	return ''
}
</script>

<template>
	<TemplateRef ref="templateRef" />

	{{ exactType($refs.templateRef?.$refs.generic?.foo, {} as (1 | undefined)) }}

	<Comp />
</template>

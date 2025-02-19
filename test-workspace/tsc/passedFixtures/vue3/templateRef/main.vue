<!-- @inferTemplateDollarRefs true -->

<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { exactType } from '../../shared';
import TemplateRefs from './template-refs.vue';

function Comp() {
	const foo = useTemplateRef('templateRef');
	exactType(foo.value, {} as unknown);
	return '';
}
</script>

<template>
	<TemplateRefs ref="templateRefs" />

	{{ exactType($refs.templateRefs?.$refs.generic?.foo, {} as (1 | undefined)) }}

	<Comp />
</template>

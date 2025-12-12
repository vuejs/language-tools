<script setup lang="ts">
import { useTemplateRef } from 'vue';
import Comp from './comp.vue';
import { exactType } from '../shared';

const compRef = useTemplateRef('comp');

exactType(compRef.value?.$el, {} as HTMLDivElement | undefined);
</script>

<template>
	<Comp ref="comp" />
</template>

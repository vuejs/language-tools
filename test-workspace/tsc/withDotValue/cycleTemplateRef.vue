<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { exactType } from '../shared';
import CycleChild from './cycleChild.vue';

const comp = useTemplateRef('comp');
const show = computed(() => comp.value?.show);
</script>

<template>
	<CycleChild ref="comp" />
	<div v-if="show">{{ exactType(show, {} as () => void) }}</div>
</template>

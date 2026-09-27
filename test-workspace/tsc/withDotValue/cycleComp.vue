<script setup lang="ts">
import { exactType } from '../shared';
import { useCycleStore } from './cycleStore';

const { visible, instance } = useCycleStore();

defineExpose({ show() {} });
</script>

<template>
	<div v-if="visible">{{ exactType(visible, true) }}</div>
	<div v-if="instance">{{ exactType(instance.show, {} as () => void) }}</div>
</template>

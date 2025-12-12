<script setup lang="ts" generic="T extends number">
import { useTemplateRef } from 'vue';

const props = defineProps<{ generic?: T }>();
const CompRef = useTemplateRef('CompRef');

CompRef.value?.exposedFunction1();
</script>

<template>
	<Comp ref="CompRef" />
</template>

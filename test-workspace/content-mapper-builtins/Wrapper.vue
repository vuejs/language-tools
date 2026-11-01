<!-- @inferTemplateDollarEl true -->

<script setup lang="ts">
import InferredChild from './InferredChild.vue';

// the props and the emit function are declared and never read, as a component may
const props = defineProps<{ size?: number }>();
const emit = defineEmits<{ done: [] }>();
const tail = 'tail' as const;
</script>

<template>
	<InferredChild title="wrapped">
		<slot name="body" :size="1" />
		<slot :name="tail" />
		{{ $el }}
	</InferredChild>
</template>

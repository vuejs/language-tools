<script setup>
import { useTemplateRef } from 'vue';

const a = useTemplateRef('a');
defineExpose({ a });
</script>

<template>
	<a ref="a" />
</template>

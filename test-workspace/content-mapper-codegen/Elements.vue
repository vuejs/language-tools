<script setup lang="ts">
import { useTemplateRef } from 'vue';

const el = useTemplateRef('el');
const contributed: true | undefined = el.value?.contributed;
</script>

<template>
	<div ref="el" />
</template>

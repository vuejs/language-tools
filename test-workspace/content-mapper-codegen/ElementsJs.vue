<script setup>
import { useTemplateRef } from 'vue';

const el = useTemplateRef('el');
/** @type {true | undefined} */
const contributed = el.value?.contributed;
</script>

<template>
	<div ref="el" />
</template>

<template>
	<HelloWorld />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

const HelloWorld = defineAsyncComponent(() => ({} as any));
</script>

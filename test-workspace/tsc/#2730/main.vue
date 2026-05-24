<script setup lang="ts">
import { type Directive } from 'vue';

const vMyDirective: Directive<HTMLElement> = {};
</script>

<template>
	<div v-my-directive></div>
</template>

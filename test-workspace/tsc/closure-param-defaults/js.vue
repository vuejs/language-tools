<script setup>
import { options } from './constants';
</script>

<template>
	<button @click="(_event, mode = options.mode) => mode.toFixed()" />
	<button @click="(_event, { mode = options.mode } = {}) => mode.toFixed()" />
</template>

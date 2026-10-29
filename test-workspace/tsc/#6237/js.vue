<script setup>
// @ts-check
import { Mode, options } from './constants';
</script>

<template>
	<button @click="() => options.mode === Mode.Regular" />
	<button @click="function () { return options.mode === Mode.Regular; }" />
	<!-- @vue-expect-error -->
	<button @click="() => options.missing" />
</template>

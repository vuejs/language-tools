<script setup lang="ts">
import { count, Mode, options } from './closureParamDefaults';

function expectMode(mode: Mode) {
	return mode;
}
</script>

<template>
	<div v-if="count" />
	<button @click="(_event, mode = options.mode) => expectMode(mode)" />
	<button @click="(_event, { mode = options.mode } = {}) => expectMode(mode)" />
	<button @click="[1].map(function (x = options.mode) { return expectMode(x); })" />
	<!-- @vue-expect-error -->
	<button @click="(_event, mode: string = options.mode) => mode" />
	<!-- @vue-expect-error -->
	<button @click="[1].map((): string => count)" />
	<!-- @vue-expect-error -->
	<button @click="(function (x = 1) { 'use strict'; return count + x; })()" />
	<!-- @vue-expect-error -->
	<button @click="((x = 1) => { 'use strict'; return count + x; })()" />
</template>

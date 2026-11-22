<script setup lang="ts">
import { exactType } from '../shared';
import { count, Mode, options } from './constants';
</script>

<template>
	<div v-if="count" />
	<button @click="(_event, mode = options.mode) => exactType(mode, {} as Mode)" />
	<button @click="(_event, { mode = options.mode } = {}) => exactType(mode, {} as Mode)" />
	<button @click="[1].map((x = options.mode) => exactType(x, {} as number))" />
	<button @click="[1].map(function (x = options.mode) { return exactType(x, {} as number); })" />
	<!-- @vue-expect-error -->
	<button @click="(_event, mode: string = options.mode) => mode" />
	<!-- @vue-expect-error -->
	<button @click="[1].map((): string => count)" />
	<!-- @vue-expect-error -->
	<button @click="(function (x = 1) { 'use strict'; return count + x; })()" />
	<!-- @vue-expect-error -->
	<button @click="((x = 1) => { 'use strict'; return count + x; })()" />
</template>

<script setup lang="ts">
import type { DirectiveBinding } from 'vue';

const vGen = <T extends number>(_el: HTMLElement, _binding: DirectiveBinding<[T, (a: T) => void]>) => {};
const vObjGen = {
	mounted<T extends number>(_el: HTMLElement, _binding: DirectiveBinding<[T, (a: T) => void]>) {},
};

function vOver(el: HTMLElement, binding: DirectiveBinding<string>): void;
function vOver(el: HTMLElement, binding: DirectiveBinding<number>): void;
function vOver(_el: HTMLElement, _binding: DirectiveBinding<string | number>) {}
</script>

<template>
	<div v-gen="[1, (_a: string) => {}]"></div>
	<div v-gen="['x', (_a: string) => {}]"></div>
	<div v-obj-gen="[1, (_a: string) => {}]"></div>
	<div v-over="true"></div>
</template>

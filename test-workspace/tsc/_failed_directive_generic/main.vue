<script setup lang="ts">
import type { DirectiveBinding } from 'vue';

const vGen = <T extends number>(_el: HTMLElement, _binding: DirectiveBinding<[T, (a: T) => void]>) => {};
const vObjGen = {
	mounted<T extends number>(_el: HTMLElement, _binding: DirectiveBinding<[T, (a: T) => void]>) {},
};

function vOver(el: HTMLElement, binding: DirectiveBinding<string>): void;
function vOver(el: HTMLElement, binding: DirectiveBinding<number>): void;
function vOver(_el: HTMLElement, _binding: DirectiveBinding<string | number>) {}

// only the last overload's arity is used, so earlier overloads with a different arity are skipped
function vOverArity(el: HTMLElement, binding: DirectiveBinding<string>): void;
function vOverArity(el: HTMLElement, binding: DirectiveBinding<number>, vnode: unknown): void;
function vOverArity(_el: HTMLElement, _binding: DirectiveBinding<string | number>, _vnode?: unknown) {}
</script>

<template>
	<div v-gen="[1, (_a: string) => {}]"></div>
	<div v-gen="['x', (_a: string) => {}]"></div>
	<div v-obj-gen="[1, (_a: string) => {}]"></div>
	<div v-over="true"></div>
	<div v-over-arity="'a'"></div>
</template>

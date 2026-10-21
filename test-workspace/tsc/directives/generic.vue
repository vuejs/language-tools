<script setup lang="ts">
import type { DirectiveBinding } from 'vue';
import { exactType } from '../shared';

const vGen = <T extends number>(_el: HTMLElement, _binding: DirectiveBinding<[T, (a: T) => void]>) => {};
const vObjGen = {
	mounted<T extends number>(_el: HTMLElement, _binding: DirectiveBinding<[T, (a: T) => void]>) {},
};
const vGenFull = <T extends number>(
	_el: HTMLElement,
	_binding: DirectiveBinding<[T, (a: T) => void]>,
	_vnode: unknown,
	_prevVNode: unknown,
) => {};

function vOver(el: HTMLElement, binding: DirectiveBinding<string>): void;
function vOver(el: HTMLElement, binding: DirectiveBinding<number>): void;
function vOver(_el: HTMLElement, _binding: DirectiveBinding<string | number>) {}

function vOverGen<T extends number>(el: HTMLElement, binding: DirectiveBinding<[T, (a: T) => void]>): void;
function vOverGen(el: HTMLElement, binding: DirectiveBinding<string>): void;
function vOverGen(_el: HTMLElement, _binding: DirectiveBinding<any>) {}

function vOverArity(el: HTMLElement, binding: DirectiveBinding<string>): void;
function vOverArity(el: HTMLElement, binding: DirectiveBinding<number>, vnode: unknown): void;
function vOverArity(_el: HTMLElement, _binding: DirectiveBinding<string | number>, _vnode?: unknown) {}
</script>

<template>
	<div v-gen="[1, (_a: 1) => {}]"></div>
	<div v-gen="[1, (_a: number) => {}]"></div>
	<div v-gen="[1, a => exactType(a, {} as 1)]"></div>
	<div v-obj-gen="[1, (_a: 1) => {}]"></div>
	<div v-obj-gen="[1, a => exactType(a, {} as 1)]"></div>
	<div v-gen-full="[1, (_a: 1) => {}]"></div>
	<div v-over="'a'"></div>
	<div v-over="1"></div>
	<div v-over-gen="[1, (_a: 1) => {}]"></div>
	<div v-over-gen="'a'"></div>
	<div v-over-arity="'a'"></div>
	<div v-over-arity="1"></div>
</template>

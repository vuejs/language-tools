<script setup lang="ts">
import type { Directive, DirectiveBinding } from 'vue';

// Vue passes `undefined` as the binding value of a valueless directive.
let vOptional!: Directive<HTMLElement, string | undefined>;
let vAny!: Directive<HTMLElement>;
let vFn!: (el: HTMLElement, binding: DirectiveBinding<number | undefined>) => void;
</script>

<template>
	<div v-optional />
	<div v-any />
	<div v-fn />
</template>

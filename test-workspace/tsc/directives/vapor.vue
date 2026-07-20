<!-- @vapor true -->
<script setup lang="ts">
// Mirrors the custom directive contract from Vue's minor branch.
type VaporDirective = (
	node: Element,
	value?: () => unknown,
	argument?: string,
	modifiers?: Record<string, boolean>,
) => void;

const value = 1;
const vCustom: VaporDirective = () => { };
</script>

<template>
	<div v-custom:foo.bar="value"></div>
	<div v-show="true"></div>
</template>

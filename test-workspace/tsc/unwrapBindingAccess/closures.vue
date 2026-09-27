<script setup lang="ts">
import { exactType } from '../shared';
import { importedNull, PinnedStep } from './pinned';

let open = Math.random() > 0.5;
function toggle() {
	open = !open;
}
</script>

<template>
	<!-- imports and reassigned `let` read inside template closures: top-level narrowing does not reach them -->
	<div v-if="!open" :ref="(el) => !open && el" @click="toggle" />
	<button @click="() => exactType(PinnedStep.Done, {} as PinnedStep.Done)" />
	<button @click="() => importedNull && exactType(importedNull, {} as () => number)" />
	<button @click="function () { exactType(open, {} as boolean) }" />
	<div :title="[1].map(() => String(open)).join()" />
	<button @click="() => { open = true }" />
</template>

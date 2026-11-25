<script setup>
import { EMPTY_ID, Status } from '../constants';

/** @returns {import('vue').MaybeRef<string | undefined>} */
function getValue() { return Math.random() ? 'value' : undefined; }
const maybe = getValue();
const missing = undefined;
const nil = null;
const rows = ['one', 'two'];
let mutable = getValue();
</script>

<template>
	<div v-if="missing">{{ missing }}</div>
	<div v-if="nil">{{ nil }}</div>
	<div v-if="maybe">
		{{ maybe.toUpperCase() }}
		<button @click="maybe.toUpperCase()" />
	</div>
	<div v-if="mutable">
		<button @click="mutable.toUpperCase()" />
	</div>
	<div v-if="EMPTY_ID === 'none'">
		{{ rows.filter(row => row !== EMPTY_ID) }}
	</div>
	<template v-for="item in [1, 'ellipsis']" :key="item">
		<span v-if="item === 'ellipsis'" />
		<button v-else @click="item.toFixed()" />
	</template>
	{{ Status.Active }}
	<div v-if="Status.Active">{{ Status.Active }}</div>
</template>

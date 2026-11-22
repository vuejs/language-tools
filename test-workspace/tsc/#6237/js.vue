<script setup>
import { EMPTY_ID, SOME_CONST } from "./constants";

const rows = ["one", "two"];
let count = 1;
function increment() {
	count++;
}
</script>

<template>
	<button @click="() => console.log(SOME_CONST.A)">CLICK</button>
	<button @click="() => { /* ... */; () => console.log(SOME_CONST.A) }">CLICK</button>
	<button @click="() => () => () => console.log(SOME_CONST.A)">CLICK</button>
	<div v-if="EMPTY_ID === 'none'">
		{{ rows.filter(row => row !== EMPTY_ID) }}
		{{ rows.map(() => rows.map(() => SOME_CONST.A)) }}
		{{ rows.map(function () { return SOME_CONST.A; }) }}
		{{ ({ method() { return SOME_CONST.A; }, get getter() { return SOME_CONST.A; } }) }}
		{{ new (class { field = 1; method() { return SOME_CONST.A; } })() }}
		{{ rows.map(row => row.length) }}
	</div>
	<button @click="increment">CLICK</button>
	<div v-if="count">{{ rows.map(() => count.toFixed()) }}</div>
</template>

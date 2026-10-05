<script setup lang="ts">
import { exactType } from '../shared';
import { COUNT, SOME_CONST, SOME_REF } from './constants';

let flag = false;
function toggle() {
	flag = !flag;
}
</script>

<template>
	<button @click="() => exactType(SOME_CONST.A, 'A' as const)"></button>
	<button @click="() => exactType(SOME_REF.A, 'A' as const)"></button>
	<button @click="() => COUNT++"></button>
	<button @click="() => { COUNT = 5; }"></button>
	<button @click="() => { if (flag) toggle(); }"></button>
	<div>{{ [0].map(() => exactType(SOME_CONST.A, 'A' as const)) }}</div>
	<div>{{ exactType(SOME_CONST.A, 'A' as const) }}</div>
</template>

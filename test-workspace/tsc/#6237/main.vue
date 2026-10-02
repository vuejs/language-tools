<script setup lang="ts">
import { exactType } from '../shared';
import { SOME_CONST, SOME_REF } from './constants';
</script>

<template>
	<button @click="() => exactType(SOME_CONST.A, 'A' as const)"></button>
	<button @click="() => exactType(SOME_REF.A, 'A' as const)"></button>
	<div>{{ [0].map(() => exactType(SOME_CONST.A, 'A' as const)) }}</div>
	<div>{{ exactType(SOME_CONST.A, 'A' as const) }}</div>
</template>

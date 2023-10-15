<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';
import Comp, { Column } from './Comp.vue';

interface Row {
	name: string;
	count: number;
}

const columns: Column[] = [];
const rows: Row[] = [];
</script>

<template>
	<Comp :columns="columns" :rows="rows">
		<template #col(count)="col">{{ exactType(col, {} as Column) }}</template>
		<template #row(name)="row">{{ exactType(row, {} as Row) }}</template>
	</Comp>
</template>
<script setup lang="ts">
import { exactType } from '../../shared';
import Child, { Column } from './child.vue';

interface Row {
	name: string;
	count: number;
}

const columns: Column[] = [];
const rows: Row[] = [];
</script>

<template>
	<Child :columns="columns" :rows="rows">
		<template #col(count)="col">{{ exactType(col, {} as Column) }}</template>
		<template #row(name)="row">{{ exactType(row, {} as Row) }}</template>
	</Child>
</template>
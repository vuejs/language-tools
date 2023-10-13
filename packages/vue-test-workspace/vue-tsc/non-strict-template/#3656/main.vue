<script setup lang="ts">
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
		<!-- Expected: `col` should have type `Column` -->
		<!-- In fact: `col` have type `Row`, but output is right -->
		<template #col(count)="col">{{ col }}</template>
		<template #row(name)="row">{{ row.name.toUpperCase() }}</template>
	</Comp>
</template>
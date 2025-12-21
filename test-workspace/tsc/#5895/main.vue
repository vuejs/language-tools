<script setup lang="ts" generic="TValue extends string, TGrid extends readonly (readonly TValue[])[]">
import { type MaybeRef, unref } from 'vue';

const getGridKey = (rowIndex: number, columnIndex: number) =>
  `${rowIndex}|${columnIndex}`;

class Grid<TValue, TGrid extends readonly (readonly TValue[])[]> {
  grid!: MaybeRef<TGrid>;
}

const { grid } = defineProps<{
  grid: Grid<TValue, TGrid>;
}>();
</script>

<template>
  <template v-for="(row, rowIndex) of unref(grid.grid)" :key="rowIndex">
    <div v-for="(_text, columnIndex) of row" :key="getGridKey(rowIndex, columnIndex)" />
  </template>
</template>

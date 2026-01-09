<script setup lang="ts" generic="T extends string, TGrid extends readonly (readonly T[])[]">
import { exactType } from '../shared';
</script>

<template>
  <template v-for="(row, rowIndex) of ({} as TGrid)">
    {{ exactType(rowIndex, {} as number) }}
    <template v-for="(col, columnIndex) of row">
			{{ exactType(col, {} as T) }}
			{{ exactType(columnIndex, {} as number) }}
    </template>  
  </template>
</template>

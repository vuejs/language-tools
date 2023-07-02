<template>
  <Foo>
    <template
      v-for="col in slotFilters"
      :key="col"
      #[`filter-cell-${col}`]="{ column }"
    >{{ column }}</template>
  </Foo>
</template>

<script setup>
const slotFilters = [1, 2]
</script>

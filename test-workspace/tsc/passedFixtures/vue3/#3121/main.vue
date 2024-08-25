<template>
  <Foo>
    <template
      v-for="col in slotFilters"
      :key="col"
      #[`filter-cell-${col}`]="{ column }"
    ></template>
  </Foo>
</template>

<script setup></script>

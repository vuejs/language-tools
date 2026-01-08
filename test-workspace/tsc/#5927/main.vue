<script setup lang="ts">
enum EnumA {
  Value1 = 'v1',
  Value2 = 'v2',
}

const definitions: {
  [key in EnumA]: string;
} = {
  [EnumA.Value1]: 'test1',
  [EnumA.Value2]: 'test2',
};

const test = (key: EnumA, value: string) => `${key}: ${value}`;
</script>

<template>
  <template v-for="(row, rowIndex) of definitions" :key="rowIndex">
    {{ test(rowIndex, row) }}
  </template>
</template>

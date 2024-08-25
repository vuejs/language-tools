<template>
  <Child>
    <template #[`action${n}`]="data">
      {{ exactType(data.a, {} as string) }}
    </template>
    <template #action2="data">
      {{ exactType(data.a, {} as string) }}
    </template>
  </Child>
</template>
<script lang="ts" setup>
import { exactType } from '../../shared';
import Child from './child.vue'

const n = 1 as const
</script>

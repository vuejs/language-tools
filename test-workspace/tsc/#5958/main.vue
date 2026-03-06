<script setup lang="ts">
import { exactType } from '../shared';

let a: boolean = true
let b: true | false = true
let c: true = true
let d: true | number = true
</script>

<template>
  {{ exactType(a, {} as boolean) }}
  {{ exactType(b, {} as true | false) }}
  {{ exactType(c, {} as true) }}
  {{ exactType(d, {} as true | number) }}
  <input @click="() => (a = false)" />
</template>

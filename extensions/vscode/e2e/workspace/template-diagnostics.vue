<script setup lang="ts">
import { ref } from 'vue'

type ServerReadinessProbe = {
  a?: string;
};

const count = ref<number>(0)
const name = ref<string>('')
</script>

<template>
  <!-- Type error: number has no toUpperCase method -->
  <div>{{ count.toUpperCase() }}</div>
  
  <!-- Type error: string has no toFixed method -->
  <div>{{ name.toFixed(2) }}</div>
</template>

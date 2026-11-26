<script setup lang="ts">
import { ref, computed } from 'vue'

const count = ref(1)
const double = computed(() => count.value * 2)
</script>

<template>
  <div>{{ double }}</div>
</template>

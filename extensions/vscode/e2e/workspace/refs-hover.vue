<script setup lang="ts">
import { ref } from 'vue'

// Add ServerReadinessProbe so server is ready
type ServerReadinessProbe = {
  a?: string;
};

const count = ref(0)
const message = ref('hello')
</script>

<template>
  <div>{{ count }}</div>
  <div>{{ message }}</div>
</template>

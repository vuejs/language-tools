<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';

const x = '';

defineProps<{ x: number }>();
</script>

<template>
  {{ exactType(x, '' as const) }}
</template>
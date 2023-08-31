<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';

const foo = '';

defineProps<{ foo: number }>();

const bar = '';

defineExpose({ bar: 1 });
</script>

<template>
  {{ exactType(foo, '' as const) }}
	{{ exactType(bar, '' as const) }}
</template>
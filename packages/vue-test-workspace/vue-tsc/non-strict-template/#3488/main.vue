<script setup lang="ts">
import { exactType } from 'vue-tsc/shared';

const x = '';

defineExpose({ x: 3 });
</script>

<template>
	{{ exactType(x, '' as const) }}
</template>

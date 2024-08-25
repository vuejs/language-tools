<script setup lang="ts">
import { exactType } from '../../shared';

const foo: string = '';

defineProps<{ foo: number; }>();

const bar: string = '';

defineExpose({ bar: 1 });
</script>

<template>
	{{ exactType(foo, {} as string) }}
	{{ exactType(bar, {} as string) }}
</template>

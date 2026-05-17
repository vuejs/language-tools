<script setup lang="ts">
import basic from './basic.vue';
import { exactType } from '../shared';

defineEmits<{
	(e: 'change', value: number): void;
}>();
</script>

<template>
	<basic @change="v => exactType(v, {} as string)" />
</template>

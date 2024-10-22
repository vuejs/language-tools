<script setup lang="ts">
import child from './child.vue';
import { exactType } from '../../shared';

defineEmits<{
	(e: 'change', value: number): void;
}>();
</script>

<template>
	<child @change="v => exactType(v, {} as string)" />
</template>

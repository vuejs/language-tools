<script setup lang="ts" generic="T">
import type { Slots } from './types';
defineProps<{ value: T }>();
defineSlots<Slots<T>>();
</script>
<template>
	<slot />
</template>

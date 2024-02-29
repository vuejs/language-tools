<script setup lang="ts">
import { exactType } from '../../shared';
const props = defineProps<{
	optionalBoolean?: boolean;
}>();
</script>

<template>
	<h1>{{ exactType(optionalBoolean, true as boolean) }}</h1>
</template>

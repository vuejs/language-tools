<script setup lang="ts">
import { exactType } from '../../shared';
defineProps<{
	optionalBoolean?: boolean;
}>();
</script>

<template>
	<h1>{{ exactType(optionalBoolean, {} as boolean | undefined) }}</h1>
</template>

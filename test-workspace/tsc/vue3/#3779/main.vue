<script setup lang="ts">
import { exactType } from '../../shared';

defineProps<{
	optionalBoolean?: boolean;
}>();
</script>

<template>
	{{ exactType(optionalBoolean, true as boolean) }}
</template>

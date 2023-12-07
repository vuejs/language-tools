<script setup lang="ts">
import { exactType } from '../../shared';

const props = defineProps<{
	optionalBoolean?: boolean;
}>();
</script>

<template>
	{{ exactType(optionalBoolean, true as boolean) }}
</template>

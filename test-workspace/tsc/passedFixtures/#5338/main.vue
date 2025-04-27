<script setup lang="ts">
import { exactType } from '../shared';

withDefaults(defineProps<{
    foo?: string;
}>(), {
    foo: 'foo',
});
</script>

<template>
    {{ exactType(foo, {} as string) }}
</template>

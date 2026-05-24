<script setup lang="ts">
import { exactType } from '../shared';

withDefaults(defineProps<{
    foo?: string;
    bar?: string;
}>(), {
    foo: 'foo',
});
</script>

<template>
    {{ exactType(foo, {} as string) }}
    {{ exactType(bar, {} as string | undefined) }}
</template>

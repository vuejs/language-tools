<script setup lang="ts">
import { exactType } from '../shared';

declare module 'vue' {
    interface ComponentCustomProperties {
        $attrs: {
            global: string;
        }
    }
}
</script>

<template>
    {{ exactType($attrs.global, {} as string) }}
</template>

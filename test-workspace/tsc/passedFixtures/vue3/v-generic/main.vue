<script setup lang="ts">
import { exactType } from '../../shared';
import Comp from './comp.vue';
</script>

<template>
    <Comp v-generic="string" @foo="(bar) => exactType(bar, {} as string)"/>
    <Comp v-generic="number, boolean" @foo="(bar, baz) => (
        exactType(bar, {} as number),
        exactType(baz, {} as boolean)
    )"/>
    <!-- @vue-expect-error -->
    <Comp v-generic="boolean" />
</template>
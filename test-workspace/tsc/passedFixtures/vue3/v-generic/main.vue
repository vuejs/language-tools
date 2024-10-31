<script setup lang="ts">
import { exactType } from '../../shared';
import Comp from './comp.vue';
</script>

<template>
    <Comp v-generic="number" @foo="(val) => exactType(val, {} as number)"/>
    <Comp v-generic="string" @foo="(val) => exactType(val, {} as string)"/>
    <!-- @vue-expect-error -->
    <Comp v-generic="boolean" />
</template>
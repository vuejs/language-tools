<script setup lang="ts">
import Comp from './comp.vue';

let foo!: {
    bar?: number;
};
</script>

<template>
    <!-- @vue-expect-error -->
    <Comp v-model="foo.bar" />
    <Comp v-if="foo.bar" v-model="foo.bar" />
</template>

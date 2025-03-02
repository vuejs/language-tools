<script setup lang="ts">
import Comp from './comp.vue';

let foo!: {
    bar?: number;
}
</script>

<template>
    <!-- @vue-expect-error -->
    <Comp v-model:foo="foo.bar" />

    <!-- @vue-expect-error -->
    <Comp v-model:bar="foo.bar" />
    <Comp v-if="foo.bar" v-model:bar="foo.bar" />
</template>

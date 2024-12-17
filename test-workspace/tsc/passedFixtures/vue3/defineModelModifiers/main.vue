<script setup lang="ts">
import Comp from './comp.vue';

const fooBar = 'fooBar';
</script>

<template>
    <Comp v-model:foo-bar.foo="fooBar"></Comp>
    <Comp v-model:[fooBar].bar="fooBar"></Comp>
    <!-- @vue-expect-error -->
    <Comp v-model:foo-bar.unknown="fooBar"></Comp>
</template>

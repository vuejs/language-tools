<script setup lang="ts">
import Comp from './comp.vue';

const fooBar = 'fooBar';
</script>

<template>
    <Comp v-model:foo-bar.foo.bar="fooBar"></Comp>
    <!-- @vue-expect-error -->
    <Comp v-model:[fooBar].unknown="fooBar"></Comp>
</template>

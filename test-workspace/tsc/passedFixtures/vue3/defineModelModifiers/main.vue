<script setup lang="ts">
import Comp from './comp.vue';

const fooBar = '...';
</script>

<template>
    <Comp v-model:foo-bar.foo.bar="fooBar"></Comp>
</template>

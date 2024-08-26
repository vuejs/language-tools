<script setup lang="ts">
import { ref } from 'vue';

// @ts-ignore
let a: number = '';
const msg = ref('Hello World!');
</script>

<template>
  <h1>{{ msg }}</h1>
</template>
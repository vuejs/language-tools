<script setup lang="ts">
import HelloWorld from './comp.vue';
</script>

<template>
  <HelloWorld :msg="(count) => `Vite + Vue + ${count}`" />
</template>

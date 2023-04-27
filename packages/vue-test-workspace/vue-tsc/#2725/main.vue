<script setup lang="ts">
import { ref } from 'vue';

const flag = ref(true);
</script>

<template>
  <div>
    <Component :is="flag ? 'ComA' : 'ComB'" />
    <Component :is="!flag ? 'ComA' : 'ComB'" style="background: pink" />
  </div>
</template>

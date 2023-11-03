<script setup lang="ts">
let a = 0;
</script>

<template>
  <div @click="a = 1"></div>
  <!--         ^inlayHint: "$event =>" -->
</template>
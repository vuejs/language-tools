<script setup lang="ts">
const key = {};
</script>

<template>
  <template v-for="_i in 1" :key></template>
  <template v-for="_i in 1" :key="{}"></template>
  <template v-if="true" :key></template>
  <template v-if="true" :key="{}"></template>
  <div v-if="true" :key="{}"></div>
</template>

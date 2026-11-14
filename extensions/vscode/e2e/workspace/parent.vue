<script setup lang="ts">
import Child from './child.vue'
</script>

<template>
  <!-- Missing required prop 'title' -->
  <Child :count="123" />
  
  <!-- Type error: count should be number, not string -->
  <Child :count="'hello'" :title="'world'" />
</template>

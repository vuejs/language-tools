<template>
  <Child @change="(value) => console.log(value)" />
  <!--            ^^^^^ is inferred as `any` now, should be `string` -->
</template>

<script lang="ts" setup>
import Child from './child.vue'
</script>

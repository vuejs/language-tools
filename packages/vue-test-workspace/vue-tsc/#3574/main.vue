<template>
  <Comp @change="(value) => console.log(value)" />
  <!--            ^^^^^ is inferred as `any` now, should be `string` -->
</template>

<script lang="ts" setup>
import Comp from './Comp.vue'
</script>

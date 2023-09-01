<script setup lang="ts">
const foo = true;
</script>

<template>
  <Comp>
    <template v-if="true" #foo />
    <template v-else-if="foo" #bar />
  </Comp>
</template>

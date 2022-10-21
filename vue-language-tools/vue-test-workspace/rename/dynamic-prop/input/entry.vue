<template>
    <div :[foo]="123"></div>
      <!-- ^rename: bar -->
</template>

<script lang="ts" setup>
const foo = 'foo';
   // ^rename: bar
</script>
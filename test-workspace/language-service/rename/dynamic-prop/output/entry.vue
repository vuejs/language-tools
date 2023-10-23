<template>
    <div :[bar]="123"></div>
      <!-- ^rename: bar -->
</template>

<script lang="ts" setup>
const bar = 'foo';
   // ^rename: bar
</script>
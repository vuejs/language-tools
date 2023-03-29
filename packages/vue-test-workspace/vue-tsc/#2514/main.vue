<template>
  <div @[eventName]="({} as any)" />
</template>

<script setup lang="ts">
let eventName: string | null;
</script>

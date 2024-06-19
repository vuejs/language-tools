<script setup lang="ts">
import Comp from './Comp.vue';

const t = 'a-b'
</script>

<template>
  <Comp>
    <template #a-b="s"></template>
    <template #ab="s"></template>
    <template #c-d="s"></template>
    <!--       ^inlayHint: "Slot<any>" -->
    <template #cd="s"></template>
		<template #[t]="s"></template>
  </Comp>
</template>

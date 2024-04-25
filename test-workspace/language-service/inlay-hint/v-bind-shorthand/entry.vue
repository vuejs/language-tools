<script setup lang="ts">
let foo = 0;
let name = '';
</script>

<template>
  <div :foo></div>
  <!--     ^inlayHint: '="foo"' -->
  <slot :foo></slot>
  <!--      ^inlayHint: '="foo"' -->
  <slot :name></slot>
  <!--       ^inlayHint: '="name"' -->
  <component :is></component>
  <!--          ^inlayHint: '="is"' -->
</template>

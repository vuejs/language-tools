<template>
  <div>
    <component :is="component1"></component>
  </div>
</template>

<script setup lang="ts">
import type { VNode } from 'vue';
import { h } from 'vue';

const component1: VNode = h('span', 'Foobar');
</script>

<template>
  <view @tap="test()"></view>
</template>

<script setup lang="ts">
import { h } from 'vue';

const test = () => {
  return h('p', {}, 'test');
};
</script>

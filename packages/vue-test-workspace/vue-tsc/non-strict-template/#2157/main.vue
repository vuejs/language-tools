<script setup lang="ts">
declare module 'vue' {
  export interface GlobalComponents {
    Transition: typeof import('vue')['Transition'];
  }
};
</script>

<template>
	<Transition enter-active-class=""></Transition>
</template>

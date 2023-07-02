<script setup lang="ts">
declare module 'vue' {
  export interface GlobalComponents {
    TransitionWithinTestIssue2157: typeof import('vue')['Transition'];
  }
};
</script>

<template>
	<TransitionWithinTestIssue2157 enter-active-class=""></Transition>
</template>

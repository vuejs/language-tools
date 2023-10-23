<script setup lang="ts">
declare module 'vue' {
	export interface GlobalComponents {
		TransitionForIssue2157: typeof import('vue')['Transition'];
	}
};
</script>

<template>
	<TransitionForIssue2157 enter-active-class="" />
</template>

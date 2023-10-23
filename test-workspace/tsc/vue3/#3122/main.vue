<template>
	<Child @click="onClick" />
</template>

<script setup lang="ts">
import Child from './child.vue';

declare const onClick: (() => void) | undefined;
</script>
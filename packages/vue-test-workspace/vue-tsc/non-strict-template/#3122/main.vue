<template>
	<Comp @click="onClick" />
</template>

<script setup lang="ts">
import Comp from './Comp.vue';

declare const onClick: (() => void) | undefined;
</script>
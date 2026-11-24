<script setup lang="ts">
import { exactType } from '../shared';
import child from './child.vue';
import runtime from './runtime.vue';
</script>

<template>
	<child :value="1" :on-submit="v => exactType(v, {} as number)" />
	<runtime :value="1" :on-submit="(v: number) => v" />
</template>

<script setup lang="ts">
import { exactType } from '../shared';

declare module 'vue' {
	export interface GlobalComponents {
		Foo: typeof import('vue')['Transition'];
	}
};
</script>

<template>
	<Foo enter-active-class="" @enter="el => exactType(el, {} as Element)" />
</template>

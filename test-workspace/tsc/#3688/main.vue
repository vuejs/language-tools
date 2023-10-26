<template>
	{{ () => {
		if (Array.isArray(__VLS_styleScopedClasses)) {
			exactType(__VLS_styleScopedClasses, {} as 'foo'[]);
		}
	} }}
</template>

<script setup lang="ts">
import { exactType } from '../shared';
</script>

<style>
.foo {
	color: red;
}
</style>

<template>
	{{ () => {
		exactType(__VLS_styleScopedClasses, {} as { 'foo'?: boolean });
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

<!-- @experimentalResolveStyleCssClasses "always" -->

<template>
	{{ () => {
		exactType({} as __VLS_StyleScopedClasses, {} as { 'foo': boolean });
	} }}
</template>

<script setup lang="ts">
import { exactType } from '../../shared';
</script>

<style>
.foo {
	color: red;
}
</style>

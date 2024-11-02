<script setup lang="ts">
import { exactType } from '../../shared';
import Comp from './comp.vue';
</script>

<template>
	<!-- @vue-generic {string} -->
	<Comp @foo="(bar) => exactType(bar, {} as string)" />
	<!-- @vue-generic {number, boolean} -->
	<Comp @foo="(bar, baz) => (
		exactType(bar, {} as number),
		exactType(baz, {} as boolean)
	)" />
	<!-- @vue-expect-error -->
	<!-- @vue-generic {boolean} -->
	<Comp />
</template>

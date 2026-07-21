<!-- @vapor true -->
 
<script setup lang="ts">
import { exactType } from '../shared';

let vCustom!: (
	node: Element,
	value?: () => (_: boolean) => void,
	argument?: 'foo',
	modifiers?: Record<'attr' | 'prop', boolean>,
) => void;
</script>

<template>
	<div v-custom:foo="v => exactType(v, {} as boolean)"></div>
	<!-- @vue-expect-error -->
	<div v-custom:bar="v => exactType(v, {} as boolean)"></div>

	<div v-custom.attr.prop="v => exactType(v, {} as boolean)"></div>
	<!-- @vue-expect-error -->
	<div v-custom.unknown="v => exactType(v, {} as boolean)"></div>
</template>

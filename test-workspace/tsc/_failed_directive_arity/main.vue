<script setup lang="ts">
import type { DirectiveBinding } from 'vue';

let Comp!: (_: { foo?: string; }) => void;

let vShort!: (el: typeof Comp, binding: DirectiveBinding<number, 'attr' | 'prop'>) => void;
</script>

<template>
	<Comp v-short="'nope'" />
	<Comp v-short.unknown="123" />
</template>

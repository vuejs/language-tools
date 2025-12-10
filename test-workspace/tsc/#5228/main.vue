<script setup lang="ts" generic="T extends string">
defineSlots<{
	[K in `slot:${T}`]?: () => any;
}>();

let slots!: T[];
</script>

<template>
	<div v-for="slot of slots">
		<slot :name="`slot:${slot}`"></slot>
	</div>
</template>

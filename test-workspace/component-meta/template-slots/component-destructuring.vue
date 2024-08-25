<template>
	<component-destructure #bottom="{ num }">
		{{ num }}
	</component-destructure>

	<bottom :num="1" />
</template>

<script setup lang="ts">
const { bottom } = defineSlots<{
	bottom: (props: { num: number }) => any[],
}>()
</script>

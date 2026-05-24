<template>
	<!-- @vue-expect-error -->
	<button @click="a.b"></button>
	<!-- @vue-expect-error -->
	<button @click="a.c.d"></button>
</template>

<script lang="ts" setup>
const a = {
	b(_msg: string) { },
	c: {
		d(_msg: string) { }
	},
}
</script>

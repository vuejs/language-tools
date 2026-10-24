<script setup>
defineProps({
	a: String,
	onPing: /** @type {import('vue').PropType<(n: number) => void>} */ (Function),
});
defineEmits({
	foo: () => true,
	/** @param {number} n */
	bar: n => n > 0,
	/** @param {string} value */
	'update:a': value => !!value,
});
</script>

<template>
	<div />
</template>

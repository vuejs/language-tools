<script setup>
/** @type {number} */
let count;
setTimeout(() => {
	count = 1;
});
</script>

<template>
	<div v-if="count">{{ count.toFixed() }}</div>
</template>

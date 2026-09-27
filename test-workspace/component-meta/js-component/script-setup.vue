<script setup>
defineProps({
	foo: String,
	bar: { type: Number, required: true },
});
</script>

<template>
	<slot name="header" :count="bar"></slot>
</template>

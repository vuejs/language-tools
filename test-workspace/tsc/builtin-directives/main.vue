<script setup lang="ts">
const msg = 'hello';
const deps = [1, 2];
</script>

<template>
	<div v-html="msg" />
	<div v-text="msg" />
	<div v-cloak />
	<div v-memo="deps" />
</template>

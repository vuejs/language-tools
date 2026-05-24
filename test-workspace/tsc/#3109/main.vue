<template>
	<Transition appear name="slide" :key="ready"></Transition>
</template>

<script lang="ts" setup>
const ready = 'ready';
</script>

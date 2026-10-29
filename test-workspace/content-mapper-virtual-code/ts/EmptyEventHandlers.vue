<script setup lang="ts">
import Comp from './Comp.vue';
</script>

<template>
	<div @click="" />
	<div @click.stop="" />
	<div @click.stop="   " />
	<div @click.stop="/* no-op */" />
	<div @click.stop />
	<Comp @foo="" @bar="   " />
</template>

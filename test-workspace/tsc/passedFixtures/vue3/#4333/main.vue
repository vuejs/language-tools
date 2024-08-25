<script setup lang="ts">
function onItemInteraction(_e: MouseEvent | Event) { }
</script>

<template>
	<div v-on="{ click: onItemInteraction, keydown: onItemInteraction }"></div>
</template>

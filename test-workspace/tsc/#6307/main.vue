<script setup lang="ts">
import child from './child.vue';

function onSelect(id: number) {
	console.log(id);
}
</script>

<template>
	<child :value="1" @select="onSelect" />
</template>

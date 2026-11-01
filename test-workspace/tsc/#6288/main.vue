<script setup lang="ts">
import Child from './child.vue';

function log(_: Event) {}
</script>

<template>
	<Child
		:content="{
			onClose: (event: Event) => {
				event.preventDefault()
				log(event)
			},
		}"
	/>
</template>

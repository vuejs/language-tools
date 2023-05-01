<script setup lang="ts">
import { ref } from 'vue';

type Item = {
	id: number,
	text: string
}
const items = ref(null as null | Item[])
</script>

<template>
	<div v-for="item in items" :key="item.id">
		<div>{{ item.id }}</div>
		<div>{{ item.text }}</div>
	</div>
</template>

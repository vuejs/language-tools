<script setup lang="ts">
import { ref } from 'vue';

interface Item {
	id: number | string
}
interface InfoObj {
	[key: string]: Item
}
const data = ref<Item[] | InfoObj>([])
</script>

<template>
	<div v-for="item in data">{{ item.id }}</div>
</template>

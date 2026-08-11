<script setup lang="ts">
const list = [{ id: 1 }];
</script>

<template>
	<template v-for="x of list" :key="x">
		<div>{{ x.id }}</div>
	</template>
	<template v-if="list.length" :foo="1">
		<div>{{ list.length }}</div>
	</template>
</template>

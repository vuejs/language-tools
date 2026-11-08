<script setup>
import Child from './child.vue';
</script>

<template>
	<Child @change="() => {}">
		<template #default="{ num }">{{ num.toFixed() }}</template>
		<template #named="{ str }">{{ str.length }}</template>
	</Child>
</template>

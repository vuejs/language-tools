<script setup lang="ts" generic="T">
defineProps<{ items: T[] }>();
</script>

<template>
	<div v-for="item in items"><slot :item="item" /></div>
</template>

<script setup lang="ts">
import Item from './Item.vue';
defineProps<{ ok: boolean }>();
</script>
<template>
	<Item v-if="ok" :value="1" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import HelloWorld from './component.vue';

const items = ref([1, 2, 3, 4, 5]);
</script>

<template>
	<HelloWorld msg="Vite + Vue" closable />
	<HelloWorld v-for="id in items" :key="id" msg="`Vite - ${id}`" closable />
</template>

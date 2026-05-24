<script setup lang="ts">
import { ref } from 'vue';

const values = ref([1, 2, 3]);
</script>

<template>
	<input v-for="value of values" :key="value" type="number" :value />
</template>

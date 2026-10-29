<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);
const items = ['a', 'b'];
const selected = ref('');
</script>

<template>
	<button type="button" @click="count++">{{ count }}</button>
	<button v-for="item in items" :key="item" @click="selected = item">{{ selected }}</button>
</template>

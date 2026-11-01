<script setup>
import { ref } from 'vue';
import ModelChild from './ModelChild.vue';

const text = ref('');
const count = ref(0);
</script>

<template>
	<ModelChild v-model="text" v-model:other="(count)" />
</template>

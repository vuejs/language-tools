<script setup>
import { ref } from 'vue'
import MyInput from './MyInput.vue';

const msg = ref('Hello World!')
</script>

<template>
	<MyInput disabled />
</template>

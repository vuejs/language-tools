<script setup lang="ts">
import { reactive } from 'vue';
import Child from './child.vue';

const state = reactive({ text: '' });
</script>

<template>
	<Child v-model="state.text" placeholder="http://127.0.0.1:7890" />
</template>

<template>
	<button @click="helper(123)"></button>
	<div>{{ helper(123) }}</div>
	<button @click="refHelper(123)"></button>
	<button @click="refHelper(456)"></button>
	<div>{{ refHelper(123) }}</div>
</template>
<script setup lang="ts">
import { helper } from './helper';
import { refHelper } from './refHelper';
</script>

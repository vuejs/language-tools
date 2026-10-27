<template>
	<ModelKebab v-model:foo-bar="text" />
	<ModelKebab v-model:fooBar="text" />
</template>

<script setup lang="ts">
import ModelKebab from './ModelKebab.vue';
const text = 'x';
</script>

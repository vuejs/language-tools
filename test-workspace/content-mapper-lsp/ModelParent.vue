<template>
	<Model v-model:fooBar="text" />
	<Model v-model:foo-bar="text" />
	<Model v-model="text" />
</template>

<script setup lang="ts">
import Model from './Model.vue';
const text = 'x';
</script>

<script setup lang="ts">
import { ref } from 'vue';
import Child from './child.vue';

const kind = ref('a');
</script>

<template>
	<Child v-model="kind as string" v-model:other="kind as string" />
</template>

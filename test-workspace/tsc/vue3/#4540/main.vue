<script setup lang="ts">
import { ref } from 'vue';
import Comp from './component.vue';

const model = ref(1);
</script>

<template>
	<Comp v-model="model" :foo="1" />
	<Comp v-model:model-value="model" :foo="1" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Comp from './component.vue';

const model = ref('');
</script>

<template>
	<!-- @vue-expect-error -->
	<Comp v-model="model" :foo="1" />
	<!-- @vue-expect-error -->
	<Comp v-model:model-value="model" :foo="1" />
</template>

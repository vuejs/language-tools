<script setup lang="ts">
import { ref } from 'vue';
import { Bar as Loading } from './namespace';

const loading = ref(false);
</script>

<template>
	<loading v-if="loading" />
</template>

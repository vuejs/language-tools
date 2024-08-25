<template>
	<div v-bind="{
		onClick() {
			exactType(msg, {} as string);
		}
	}"></div>
</template>

<script setup lang="ts">
import { exactType } from '../../shared';
import { ref } from 'vue';

const msg = ref('Hello Vue 3 + TypeScript + Vite');
</script>

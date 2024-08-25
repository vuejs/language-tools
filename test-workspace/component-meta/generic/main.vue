<script setup lang="ts">
import { ref } from 'vue';
import Comp from './component.vue';

const title = ref('');
</script>

<template>
	<Comp :foo="1" v-model:title="title" />
</template>
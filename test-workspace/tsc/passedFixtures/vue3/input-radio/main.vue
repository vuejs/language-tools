<template>
	<input v-model="picked" type="radio" value="One" />
	<input v-model="checked" type="checkbox" value="Two" />
</template>

<script setup lang="ts">
import { ref } from 'vue'

const picked = ref([])
const checked = ref([])
</script>

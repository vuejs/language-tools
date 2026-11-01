<script setup>
import { useTemplateRef } from 'vue'

const model = defineModel({ type: String, default: '' })
const input = useTemplateRef('input')
defineExpose({ input })
</script>

<template>
	<div :class="[$style.root, 'active']">
		<input ref="input" v-model="model" />
		<slot name="footer" :value="model" />
	</div>
</template>

<style module>
.root {}
</style>

<style scoped>
.active {}
</style>

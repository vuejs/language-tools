<template>
	<div>{{ opened }}</div>
</template>

<script setup lang="ts">
import {PropType} from 'vue'

interface O {
	asdf: number
}

const opened = defineModel('opened', {
	type: Object as PropType<O>,
	required: true,
})
</script>

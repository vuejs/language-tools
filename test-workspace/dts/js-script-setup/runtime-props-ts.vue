<script setup lang="ts">
defineProps({ label: { type: String, required: true } })
const emit = defineEmits(['go'])
</script>

<template><button @click="emit('go')">{{ label }}</button></template>

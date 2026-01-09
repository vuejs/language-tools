<script setup lang="ts">
interface Props {
  title: string
  disabled?: boolean
  count: number
}
defineProps<Props>()
</script>

<template>
  <h1>{{ title }}</h1>
  <input :disabled="disabled" />
  <span>{{ count }}</span>
</template>

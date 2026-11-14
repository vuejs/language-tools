<script setup lang="ts">
interface Props {
  title: string
  count: number
}
defineProps<Props>()
</script>

<template>
  <div>{{ title }} - {{ count }}</div>
</template>

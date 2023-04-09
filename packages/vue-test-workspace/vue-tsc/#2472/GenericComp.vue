<script setup lang="ts" generic="T">
defineSlots<{
  activator?(props: { isActive: boolean }): void
}>();
</script>

<template>
  <slot name="activator" :isActive="false" />
</template>

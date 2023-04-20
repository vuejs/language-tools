<script setup lang="ts" generic="T">
defineSlots<{
  activator?(props: { isActive: boolean }): void
}>();
</script>

<script lang="ts">
declare function defineSlots<T>(): void;
</script>

<template>
  <slot name="activator" :isActive="false" />
</template>

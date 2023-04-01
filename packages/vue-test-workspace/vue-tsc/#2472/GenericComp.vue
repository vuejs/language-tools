<script setup lang="ts" generic="T">
defineSlots<{
  activator?(props: { isActive: boolean }): void
}>();
</script>

<script lang="ts">
declare function defineSlots<T>(): T;
</script>

<template>
  <slot name="activator" :isActive="false" />
</template>

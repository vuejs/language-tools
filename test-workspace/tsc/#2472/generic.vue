<script setup lang="ts" generic="T">
defineSlots<{
  activator?: (props: { isActive: boolean }) => void
}>();
null as unknown as T;
</script>

<template>
  <slot name="activator" :isActive="false" />
</template>

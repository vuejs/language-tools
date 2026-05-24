<template>
    <div v-for="item in props.items" :key="item.index" >
      <slot :item="item" name="content" />
    </div>
</template>

<script setup lang="ts" generic="T extends {index: number}">
const props = defineProps<{
  items: T[];
}>();
</script>

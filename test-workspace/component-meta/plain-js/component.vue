<script setup>
defineProps({
  foo: {
    type: String,
    required: true
  },
  bar: {
    type: Number,
    default: 1
  }
});
defineEmits(['change']);
</script>

<template>
  <slot name="header" :count="1" />
</template>

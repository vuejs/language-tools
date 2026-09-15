<script setup lang="ts" generic="T">
import Item from './Item.vue';
defineProps<{ value: T }>();
</script>
<template><Item :value="value" /></template>

<script lang="ts">
import { defineComponent } from 'vue';
import Item from './Item.vue';
export default defineComponent({ components: { OptionsShadow: Item } });
</script>
<template><OptionsShadow :value="1" /></template>

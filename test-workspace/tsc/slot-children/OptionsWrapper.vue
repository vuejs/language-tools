<script lang="ts">
import { defineComponent } from 'vue';
import Item from './Item.vue';
export default defineComponent({ components: { Item } });
</script>
<template>
	<Item :value="1" />
</template>

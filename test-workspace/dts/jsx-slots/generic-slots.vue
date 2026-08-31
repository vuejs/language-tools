<script setup lang="ts" generic="T">
defineProps<{
	items: T[];
}>();

defineSlots<{
	default?: (props: { item: T }) => any;
}>();
</script>

<template>
	<slot v-for="item of items" :item="item" />
</template>

<script setup lang="ts">
defineProps<{ url?: string | RegExp }>();
defineEmits<{ done: [value: number] }>();
defineModel<string>();
</script>

<template>
	<slot />
</template>

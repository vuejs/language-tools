<script setup lang="ts">
defineProps<{ msg: string; name?: string }>();
defineSlots<{
	default(props: { slotValue: string }): unknown;
	help(): unknown;
	errorMessage(): unknown;
}>();
</script>

<template lang="pug">
slot(slotValue="v")
slot(name="help")
slot(name="errorMessage")
</template>

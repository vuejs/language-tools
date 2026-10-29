<script setup lang="ts">
defineProps<{
	msg: string;
}>();

defineSlots<{
	default?: (props: { msg: string }) => any;
}>();
</script>

<template>
	<slot :msg="msg" />
</template>

<script setup lang="ts">
defineSlots<{
	default: (props: { foo: string }) => any;
}>();
</script>

<template>
	<!-- @vue-expect-error -->
	<slot bar="..."></slot>
</template>

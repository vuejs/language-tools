<script setup lang="ts">
defineSlots<{
	content(): any;
	prop(props: { foo: string }): any;
}>();
</script>

<template>
	<slot name="content" />
	<slot name="prop" :foo="''" />
</template>

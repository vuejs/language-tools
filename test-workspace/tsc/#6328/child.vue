<script setup lang="ts">
defineSlots<{
	foo(props: { item: string }): unknown;
	bar(): unknown;
}>();
</script>

<template>
	<slot name="foo" item="a" />
	<slot name="bar" />
</template>

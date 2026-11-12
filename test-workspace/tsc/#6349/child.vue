<script setup lang="ts">
defineSlots<{ title?(): unknown }>();
</script>

<template>
	<slot name="title" />
</template>

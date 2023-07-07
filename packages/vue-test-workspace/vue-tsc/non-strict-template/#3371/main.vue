<script setup lang="ts">
defineSlots<{ content(): any; }>();
</script>

<template>
	<div class="hello-world">
		<slot name="content" />
	</div>
</template>

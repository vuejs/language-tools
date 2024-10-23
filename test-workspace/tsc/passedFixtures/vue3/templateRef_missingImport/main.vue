<script setup lang="ts">
declare const foo: number;
</script>

<template>
	<TemplateRef ref="templateRef" />
	{{ foo }}
</template>

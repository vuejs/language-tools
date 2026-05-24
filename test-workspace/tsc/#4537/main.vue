<script setup lang="ts" generic="T">
defineProps<{
	type: T;
}>();

defineModel<boolean>({ required: true });
</script>

<template>
	<div class="['radio']"></div>
</template>

<style>
.\[\'radio\'\] {
	color: red
}
</style>

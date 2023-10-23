<script setup lang="ts" generic="T extends string | number">
defineProps<{ options: T[]; }>();
</script>

<template>
	<ul>
		<li v-for="option of options">{{ option }}</li>
	</ul>
</template>

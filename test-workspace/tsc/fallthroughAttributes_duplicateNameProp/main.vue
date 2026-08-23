<script setup lang="ts">
import child from './child.vue';
</script>

<template>
	<child :bar="1" />
	<!-- @vue-expect-error -->
	<child bar="1" />
</template>

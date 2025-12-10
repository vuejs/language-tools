<script setup lang="ts">
import basic from './basic.vue';
</script>

<template>
	<basic :bar="1" />
	<!-- @vue-expect-error -->
	<basic bar="1" />
</template>

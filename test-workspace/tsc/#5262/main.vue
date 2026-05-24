<script setup lang="ts">
import Comp from './comp.vue';
</script>

<template>
	<!-- @vue-expect-error -->
	<Comp :foo="() => 'foo'" />
</template>

<script setup lang="ts">
import { ref } from "vue";

const foo = ref<{ bar: string } | undefined>();
</script>

<template>
	<!-- @vue-expect-error -->
	<div v-if="foo.bar || foo"></div> 
</template>
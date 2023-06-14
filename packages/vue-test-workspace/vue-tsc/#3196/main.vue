<script setup lang="ts">
import Comp from './Comp.vue';
</script>

<template>
	<Comp @foo="(x) => x" />
</template>

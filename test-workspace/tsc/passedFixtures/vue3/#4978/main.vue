<script setup lang="ts">
import Comp from './comp.vue';
</script>

<template>
	<Comp :model-modifiers="{ foo: true }" />
</template>

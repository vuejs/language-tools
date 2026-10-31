<script setup lang="ts">
import GenericPlugin from './GenericPlugin.vue';
</script>

<template>
	<GenericPlugin item="a" />
	<GenericPlugin :item="1" />
</template>

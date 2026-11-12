<script setup lang="ts">
import { useTemplateRef } from 'vue';

const container = useTemplateRef('container');
</script>

<template>
	<div ref="container">
		<slot></slot>
	</div>
</template>

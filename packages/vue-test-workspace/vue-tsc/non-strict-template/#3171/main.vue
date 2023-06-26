<script setup lang="ts">
import { h } from 'vue';

const eventSummary = () => h('div');
</script>

<template>
	<div>
		<component :is="{ render: eventSummary }" :render="({} as any)" />
	</div>
</template>
<script setup lang="ts">
import { defineComponent, h } from 'vue';

const eventSummary = () => h('div');
</script>

<template>
	<div>
		<component :is="defineComponent({ render: eventSummary })" />
	</div>
</template>
<script setup lang="ts">
import { h } from 'vue';

const eventSummary = () => h('div');
const a = { render: eventSummary };
</script>

<template>
	<div>
		<component :is="{ render: eventSummary }" />
		<component :is="a" />
	</div>
</template>
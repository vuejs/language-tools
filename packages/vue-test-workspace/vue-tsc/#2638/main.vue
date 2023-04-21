<script setup lang="ts">
import { h } from 'vue';

const test = () => {
	return h('p', {}, 'test');
};
</script>

<template>
	<test foo="123" />
</template>

<template>
	<HelloWorld @submit="handler()" />
</template>

<script lang="ts" setup>
import HelloWorld from './component.vue';

const handler = () => {
	console.log('submit');
};
</script>

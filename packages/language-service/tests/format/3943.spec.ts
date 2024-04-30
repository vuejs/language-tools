import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<!--  -->
<script setup lang="ts">
</script>

<template>
	<router-view v-slot="{ Component, route }">
		<keep-alive>
			<component :is="Component" v-if="route.meta.keepAlive" />
		</keep-alive>
		<component :is="Component" v-if="!route.meta.keepAlive" />
	</router-view>
	<template></template>
	<template></template>
	<template></template>
	<div>
		<template></template>
	</div>
</template>
	`.trim(),
});

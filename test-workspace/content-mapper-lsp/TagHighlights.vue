<script setup lang="ts">
import TypeProps from './TypeProps.vue';
const msg = 'hi';
</script>

<template>
	<div>
		<TypeProps></TypeProps>
	</div>
	<TypeProps />
	<div :title="msg"></div>
</template>

<script setup lang="ts">
import child from './child.vue';
const foo = 1;
//    ^reference: 1 
const bar = '';
//    ^reference: 1 
const fooBar = 1;
//    ^reference: 1 
</script>

<template>
	<child :foo></child>
	<!-- @vue-expect-error should typecheck -->
	<child :bar></child>
	<child :foo-bar></child>
</template>

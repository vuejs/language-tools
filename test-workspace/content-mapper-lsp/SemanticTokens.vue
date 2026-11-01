<script setup lang="ts">
import SlotsChild from './SlotsChild.vue';
const vFocus = { mounted() {} };
const msg = 'hi';
const is = SlotsChild;
</script>

<template>
	<div id="a" :title="msg" class="x" v-focus:arg.mod="msg"></div>
	<svg><path d="M0" /></svg>
	<SlotsChild fooBar="x" />
	<SlotsChild :fooBar="msg">
		<template #default="{ item }">{{ item }}</template>
		<template v-slot:named></template>
	</SlotsChild>
	<component :is />
</template>

<script setup lang="ts">
const exist = {};

declare function Comp(props: { foo: string }): any;
</script>

<template>
	<!-- @vue-ignore -->
	<div v-if="true">
		{{ notExist }}
	</div>

	<!-- @vue-ignore -->
	<div v-for="_a in 10" :foo="notExist">
		{{ notExist }} 
	</div>

	<!-- @vue-expect-error -->
	<div v-bind="exist"></div>

	<!-- @vue-expect-error -->
	<Comp foo="bar" />
</template>

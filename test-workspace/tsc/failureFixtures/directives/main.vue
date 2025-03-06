<template>
	<div v-if="true">
		<!-- @vue-ignore -->
		{{ notExist }}
	</div>

	<!-- @vue-ignore -->
	<div v-for="_a in 10" :foo="notExist">
		<!-- @vue-ignore -->
		{{ notExist }} 
	</div>

	<!-- @vue-expect-error -->
	<div v-bind="exist"></div>
</template>

<script setup lang="ts">
const exist = {};
</script>

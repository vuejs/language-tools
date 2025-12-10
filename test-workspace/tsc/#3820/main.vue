<script setup lang="ts" generic="T extends { name: string }">
const props = defineProps<{
	one: T;
	all: Array<T>;
}>();
</script>

<template>
	<div>
		<!-- incorrect inference -->
		<div>{{ one.name }}</div>
		<!-- correct inference -->
		<div>{{ props.one.name }}</div>
		<ul>
			<!-- correct inference -->
			<li v-for="el in all">{{ el.name }}</li>
		</ul>
	</div>
</template>

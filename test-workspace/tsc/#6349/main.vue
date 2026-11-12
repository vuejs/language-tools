<script setup lang="ts">
import Child from './child.vue';
</script>

<template>
	<Child>
		<template #title>title</template>
	</Child>
	<Child>
		<!-- @vue-expect-error -->
		<template #titel>typo</template>
	</Child>
</template>
